package com.allclear.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;

import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 사무실 010 대표번호 공기계 실제 SMS / 장문 LMS 수신 브로드캐스트 리시버
 *
 * [왜 알림(Notification) 읽기 대신 순정 SMS_RECEIVED PDU 병합을 사용하는가]
 * 1) 알림 읽기 방식은 메시지 화면이 열려 있으면 알림이 뜨지 않아 신청이 통째로 누락되고,
 *    장문(LMS) 뒷부분(동·호수, 공동현관 비번)이 '...'으로 잘리는 치명적 단점이 있습니다.
 * 2) 자체 제작 APK에서 순정 PDU 배열을 발신자별로 이어 붙이면 장문 문자도 100% 원문 그대로 추출되며,
 *    일시적인 네트워크 지연 시에도 로컬 큐에 보관해 자동 재전송합니다.
 */
public class SmsReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }
        if (!AppPrefs.isSmsEnabled(context)) {
            return;
        }

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        String format = bundle.getString("format");
        if (pdus == null || pdus.length == 0) return;

        Map<String, StringBuilder> messagesBySender = new LinkedHashMap<>();
        for (Object pdu : pdus) {
            if (!(pdu instanceof byte[])) continue;
            SmsMessage sms = SmsMessage.createFromPdu((byte[]) pdu, format);
            if (sms == null) continue;
            String sender = sms.getOriginatingAddress();
            if (sender == null || sender.trim().isEmpty()) {
                sender = "010-0000-0000";
            }
            String body = sms.getMessageBody();
            if (body == null) body = "";

            StringBuilder sb = messagesBySender.get(sender);
            if (sb == null) {
                sb = new StringBuilder();
                messagesBySender.put(sender, sb);
            }
            sb.append(body);
        }

        if (messagesBySender.isEmpty()) return;

        final PendingResult pendingResult = goAsync();
        final Context appCtx = context.getApplicationContext();

        new Thread(() -> {
            try {
                String serverUrl = AppPrefs.getServerUrl(appCtx);
                String secret = AppPrefs.getSmsSecret(appCtx);

                for (Map.Entry<String, StringBuilder> entry : messagesBySender.entrySet()) {
                    String sender = entry.getKey();
                    String fullText = entry.getValue().toString().trim();
                    if (fullText.isEmpty()) continue;

                    ApiClient.ApiResult res = ApiClient.forwardSmsToWebhook(
                            serverUrl,
                            secret,
                            sender,
                            fullText
                    );

                    if (res.ok) {
                        AppPrefs.incrementSmsForwardedCount(appCtx);
                        boolean registered = false;
                        try {
                            JSONObject j = new JSONObject(res.body);
                            registered = j.optBoolean("registered", false);
                        } catch (Exception ignored) {
                        }
                        String tag = registered ? "✅ 자동접수 등록완료" : "ℹ️ 스팸/일반문자 제외";
                        String preview = fullText.length() > 28 ? fullText.substring(0, 28) + "…" : fullText;
                        AppPrefs.appendSmsLog(appCtx, tag + " (" + sender + ") " + preview);
                    } else {
                        AppPrefs.enqueueFailedSms(appCtx, sender, fullText);
                        AppPrefs.appendSmsLog(
                                appCtx,
                                "⚠️ 전송지연→큐보관 (" + sender + ") 사유: " + res.errorMessage
                        );
                    }
                }
            } finally {
                pendingResult.finish();
            }
        }).start();
    }
}
