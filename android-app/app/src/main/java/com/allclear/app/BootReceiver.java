package com.allclear.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * 사무실 공기계가 정전·자동 업데이트로 재부팅되었을 때 문자수신 모드가 켜져 있었다면 자동으로 복구
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            if (AppPrefs.isSmsEnabled(context)) {
                SmsKeepAliveService.startServiceSafe(context);
            }
        }
    }
}
