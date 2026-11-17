package com.allclear.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * 올클(ALL-CLEAR) 문자자동접수 전용 앱 설정 · 미전송 재시도 큐 · 최근 동작 로그 저장소
 *
 * [왜 SharedPreferences 단일 모듈로 캡슐화했는가]
 * 브로드캐스트 리시버(SmsReceiver), 백그라운드 서비스(SmsKeepAliveService), 메인 화면(MainActivity)이
 * 프로세스 재시작 이후에도 동일한 서버 주소와 보안키를 공유하고, 일시적인 와이파이/LTE 단절 시
 * 수신된 고객 문자를 최대 100건까지 영구 보존해 단 1건의 신청도 놓치지 않기 위함입니다.
 */
public final class AppPrefs {
    public static final String ACTION_UI_REFRESH = "com.allclear.app.ACTION_UI_REFRESH";
    private static final String PREF_NAME = "allclear_sms_app_prefs";

    private static final String KEY_SERVER_URL = "server_url";
    private static final String KEY_SMS_SECRET = "sms_secret";
    private static final String KEY_SMS_ENABLED = "sms_enabled";
    private static final String KEY_SMS_FORWARDED_COUNT = "sms_forwarded_count";
    private static final String KEY_SMS_QUEUE_JSON = "sms_queue_json";
    private static final String KEY_SMS_LOGS = "sms_logs";

    public static final String PROD_SERVER_URL = "https://old-clothes-app-production.up.railway.app";
    public static final String LOCAL_SERVER_URL = "http://192.168.0.10:5000";
    public static final String DEFAULT_SERVER_URL = PROD_SERVER_URL;
    public static final String DEFAULT_SMS_SECRET = "allclear-sms-secret-2026";

    private AppPrefs() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    /**
     * 사용자가 서버 주소 끝에 '/'나 '/api/sms/webhook'을 붙여 넣거나 프로토콜을 생략하더라도
     * 사설 IP는 http://, 정식 클라우드 도메인(railway.app, all-cle.com 등)은 https:// 루트 주소로 자동 정규화합니다.
     */
    public static String normalizeServerUrl(String raw) {
        if (raw == null) return DEFAULT_SERVER_URL;
        String url = raw.trim();
        if (url.isEmpty()) return DEFAULT_SERVER_URL;
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            String lower = url.toLowerCase(Locale.US);
            boolean isLocalHost = lower.startsWith("localhost")
                    || lower.startsWith("127.")
                    || lower.startsWith("10.")
                    || lower.startsWith("192.168.")
                    || lower.startsWith("172.");
            url = (isLocalHost ? "http://" : "https://") + url;
        }
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        int schemeEnd = url.indexOf("://");
        int hostStart = (schemeEnd >= 0) ? schemeEnd + 3 : 0;
        int pathStartIdx = url.indexOf('/', hostStart);
        if (pathStartIdx >= 0) {
            String origin = url.substring(0, pathStartIdx);
            String path = url.substring(pathStartIdx);
            if ("/api".equals(path) || path.startsWith("/api/")) {
                url = origin;
            }
        }
        return url;
    }

    public static String getServerUrl(Context ctx) {
        return normalizeServerUrl(prefs(ctx).getString(KEY_SERVER_URL, DEFAULT_SERVER_URL));
    }

    public static void setServerUrl(Context ctx, String url) {
        prefs(ctx).edit().putString(KEY_SERVER_URL, normalizeServerUrl(url)).apply();
    }

    public static String getSmsSecret(Context ctx) {
        String s = prefs(ctx).getString(KEY_SMS_SECRET, DEFAULT_SMS_SECRET);
        return (s == null || s.trim().isEmpty()) ? DEFAULT_SMS_SECRET : s.trim();
    }

    public static void setSmsSecret(Context ctx, String secret) {
        prefs(ctx).edit().putString(KEY_SMS_SECRET, secret == null ? "" : secret.trim()).apply();
    }

    public static boolean isSmsEnabled(Context ctx) {
        return prefs(ctx).getBoolean(KEY_SMS_ENABLED, false);
    }

    public static void setSmsEnabled(Context ctx, boolean enabled) {
        prefs(ctx).edit().putBoolean(KEY_SMS_ENABLED, enabled).apply();
    }

    public static int getSmsForwardedCount(Context ctx) {
        return prefs(ctx).getInt(KEY_SMS_FORWARDED_COUNT, 0);
    }

    public static synchronized void incrementSmsForwardedCount(Context ctx) {
        int next = getSmsForwardedCount(ctx) + 1;
        prefs(ctx).edit().putInt(KEY_SMS_FORWARDED_COUNT, next).apply();
    }

    public static synchronized void appendSmsLog(Context ctx, String line) {
        String ts = new SimpleDateFormat("HH:mm:ss", Locale.KOREA).format(new Date());
        String existing = prefs(ctx).getString(KEY_SMS_LOGS, "");
        String combined = "[" + ts + "] " + line + (existing.isEmpty() ? "" : "\n" + existing);
        String[] lines = combined.split("\n");
        StringBuilder sb = new StringBuilder();
        int maxLines = Math.min(lines.length, 25);
        for (int i = 0; i < maxLines; i++) {
            if (i > 0) sb.append("\n");
            sb.append(lines[i]);
        }
        prefs(ctx).edit().putString(KEY_SMS_LOGS, sb.toString()).apply();
        notifyUiRefresh(ctx);
    }

    public static String getSmsLogs(Context ctx) {
        String logs = prefs(ctx).getString(KEY_SMS_LOGS, "");
        return logs.isEmpty() ? "아직 수신·전달된 문자 기록이 없습니다." : logs;
    }

    public static class QueuedSmsItem {
        public final String from;
        public final String text;

        public QueuedSmsItem(String from, String text) {
            this.from = from;
            this.text = text;
        }
    }

    public static synchronized void enqueueFailedSms(Context ctx, String from, String text) {
        try {
            JSONArray arr = new JSONArray(prefs(ctx).getString(KEY_SMS_QUEUE_JSON, "[]"));
            JSONObject obj = new JSONObject();
            obj.put("from", from);
            obj.put("text", text);
            arr.put(obj);
            JSONArray trimmed = new JSONArray();
            int start = Math.max(0, arr.length() - 100);
            for (int i = start; i < arr.length(); i++) {
                trimmed.put(arr.get(i));
            }
            prefs(ctx).edit().putString(KEY_SMS_QUEUE_JSON, trimmed.toString()).apply();
            notifyUiRefresh(ctx);
        } catch (Exception ignored) {
        }
    }

    public static synchronized int getQueuedSmsCount(Context ctx) {
        try {
            return new JSONArray(prefs(ctx).getString(KEY_SMS_QUEUE_JSON, "[]")).length();
        } catch (Exception e) {
            return 0;
        }
    }

    public static synchronized List<QueuedSmsItem> drainQueuedSms(Context ctx) {
        List<QueuedSmsItem> list = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(prefs(ctx).getString(KEY_SMS_QUEUE_JSON, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o != null) {
                    list.add(new QueuedSmsItem(o.optString("from", ""), o.optString("text", "")));
                }
            }
            prefs(ctx).edit().putString(KEY_SMS_QUEUE_JSON, "[]").apply();
        } catch (Exception ignored) {
        }
        return list;
    }

    public static void notifyUiRefresh(Context ctx) {
        try {
            Intent intent = new Intent(ACTION_UI_REFRESH);
            intent.setPackage(ctx.getPackageName());
            ctx.sendBroadcast(intent);
        } catch (Exception ignored) {
        }
    }
}
