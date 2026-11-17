package com.allclear.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import java.util.List;

/**
 * 사무실 공기계가 삼성 One UI 절전 모드로 잠들지 않도록 유지하고
 * 일시적 네트워크 끊김으로 보관된 미전송 문자를 45초마다 자동 재전송하는 포그라운드 서비스
 */
public class SmsKeepAliveService extends Service {
    private static final String CHANNEL_ID = "allclear_sms_relay_channel";
    private static final int NOTIF_ID = 1001;
    private Handler handler;
    private Runnable retryTask;

    public static void startServiceSafe(Context ctx) {
        Intent i = new Intent(ctx, SmsKeepAliveService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(i);
        } else {
            ctx.startService(i);
        }
    }

    public static void stopServiceSafe(Context ctx) {
        ctx.stopService(new Intent(ctx, SmsKeepAliveService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannelIfNeeded();
        Notification notification = buildNotification("대표번호 수신 문자 실시간 자동접수 대기 중");
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIF_ID, notification);
        }

        handler = new Handler(Looper.getMainLooper());
        retryTask = new Runnable() {
            @Override
            public void run() {
                flushQueuedSmsAsync(getApplicationContext());
                if (handler != null && AppPrefs.isSmsEnabled(getApplicationContext())) {
                    handler.postDelayed(this, 45000L);
                }
            }
        };
        handler.postDelayed(retryTask, 15000L);
    }

    public static void flushQueuedSmsAsync(Context ctx) {
        final Context appCtx = ctx.getApplicationContext();
        if (AppPrefs.getQueuedSmsCount(appCtx) == 0) return;

        new Thread(() -> {
            List<AppPrefs.QueuedSmsItem> items = AppPrefs.drainQueuedSms(appCtx);
            String serverUrl = AppPrefs.getServerUrl(appCtx);
            String secret = AppPrefs.getSmsSecret(appCtx);

            for (AppPrefs.QueuedSmsItem item : items) {
                ApiClient.ApiResult res = ApiClient.forwardSmsToWebhook(
                        serverUrl,
                        secret,
                        item.from,
                        item.text
                );
                if (res.ok) {
                    AppPrefs.incrementSmsForwardedCount(appCtx);
                    AppPrefs.appendSmsLog(appCtx, "🔄 대기열 재전송 성공 (" + item.from + ")");
                } else {
                    AppPrefs.enqueueFailedSms(appCtx, item.from, item.text);
                }
            }
        }).start();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (handler != null && retryTask != null) {
            handler.removeCallbacks(retryTask);
        }
        stopForeground(true);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID,
                    "올클 사무실 문자 자동접수",
                    NotificationManager.IMPORTANCE_LOW
            );
            ch.setDescription("사무실 대표번호 공기계 문자 자동접수 상시 대기 알림");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(String contentText) {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);

        return builder
                .setContentTitle("📩 올클 문자 자동접수 가동 중")
                .setContentText(contentText)
                .setSmallIcon(android.R.drawable.sym_action_email)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }
}
