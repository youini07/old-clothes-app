package com.allclear.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * 올클(ALL-CLEAR) 전용 사무실 문자 자동접수 안드로이드 앱 메인 화면
 *
 * [초간편 설계 의도]
 * 1) 정식 운영 서버 주소가 기본값으로 자동 세팅되어 있어 사장님이 별도 주소를 타이핑할 필요가 없습니다.
 * 2) [문자 권한 허용 & 자동접수 시작 (ON)] 버튼 하나만 켜두면, 대표번호 공기계로 들어오는
 *    모든 단문(SMS)·장문(LMS) 수거 신청을 무손실 원문 그대로 올클 백엔드 AI 파서에 실시간 직송합니다.
 * 3) Android 13/14+ 사이드로딩 APK의 '제한된 설정 허용' 잠금 발생 시 앱 정보 화면으로 즉시 연결하는 안내창을 제공합니다.
 */
public class MainActivity extends Activity {
    private static final int REQ_PERMS_SMS = 101;

    private EditText inputServerUrl;
    private TextView txtServerCheckResult;

    private EditText inputSmsSecret;
    private TextView txtSmsStatusBadge;
    private Button btnToggleSmsMode;
    private TextView txtSmsCounters;
    private TextView txtSmsLogs;

    private final BroadcastReceiver uiRefreshReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            runOnUiThread(() -> renderStateFromPrefs());
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildLayout();
        renderStateFromPrefs();

        if (AppPrefs.isSmsEnabled(this)
                && checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED) {
            SmsKeepAliveService.startServiceSafe(this);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        IntentFilter filter = new IntentFilter(AppPrefs.ACTION_UI_REFRESH);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(uiRefreshReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(uiRefreshReceiver, filter);
        }
        renderStateFromPrefs();
    }

    @Override
    protected void onPause() {
        try {
            unregisterReceiver(uiRefreshReceiver);
        } catch (Exception ignored) {
        }
        super.onPause();
    }

    private void buildLayout() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.parseColor("#F4F4F5"));
        scroll.setFillViewport(true);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(16);
        root.setPadding(pad, dp(20), pad, dp(32));

        // 1. 상단 브랜드 헤더
        LinearLayout headerCard = makeCard("#1E3A8A", "#1D4ED8");
        TextView badge = new TextView(this);
        badge.setText("ALL-CLEAR OFFICIAL APK v1.0.0");
        badge.setTextColor(Color.parseColor("#6EE7B7"));
        badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        headerCard.addView(badge);

        TextView title = new TextView(this);
        title.setText("올클 문자 자동접수 전용앱");
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        setTopMargin(title, 4);
        headerCard.addView(title);

        TextView subTitle = new TextView(this);
        subTitle.setText("사무실 010 대표번호 무손실 문자(SMS·LMS) 실시간 자동접수");
        subTitle.setTextColor(Color.parseColor("#DBEAFE"));
        subTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        setTopMargin(subTitle, 4);
        headerCard.addView(subTitle);
        root.addView(headerCard);

        // 2. 서버 주소 확인 카드
        LinearLayout serverCard = makeCard("#FFFFFF", "#E4E4E7");
        setTopMargin(serverCard, 12);

        TextView serverLabel = makeLabel("STEP 1 · 올클 서버 주소 확인 (정식 서버 자동입력됨)");
        serverCard.addView(serverLabel);

        inputServerUrl = makeEditText("예: https://old-clothes-app-production.up.railway.app");
        inputServerUrl.setText(AppPrefs.getServerUrl(this));
        inputServerUrl.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        setTopMargin(inputServerUrl, 6);
        serverCard.addView(inputServerUrl);

        LinearLayout presetRow = new LinearLayout(this);
        presetRow.setOrientation(LinearLayout.HORIZONTAL);
        setTopMargin(presetRow, 6);

        Button btnPresetProd = makeButton("🌐 올클 정식 서버", "#065F46", "#FFFFFF");
        btnPresetProd.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        LinearLayout.LayoutParams p1Lp = new LinearLayout.LayoutParams(0, dp(36), 1f);
        p1Lp.rightMargin = dp(4);
        btnPresetProd.setLayoutParams(p1Lp);
        btnPresetProd.setOnClickListener(v -> inputServerUrl.setText(AppPrefs.PROD_SERVER_URL));
        presetRow.addView(btnPresetProd);

        Button btnPresetLocal = makeButton("🏠 로컬 개발 테스트", "#3F3F46", "#FFFFFF");
        btnPresetLocal.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        LinearLayout.LayoutParams p2Lp = new LinearLayout.LayoutParams(0, dp(36), 1f);
        p2Lp.leftMargin = dp(4);
        btnPresetLocal.setLayoutParams(p2Lp);
        btnPresetLocal.setOnClickListener(v -> inputServerUrl.setText(AppPrefs.LOCAL_SERVER_URL));
        presetRow.addView(btnPresetLocal);

        serverCard.addView(presetRow);

        Button btnCheckServer = makeButton("⚡ 서버 주소 저장 및 1초 연결 확인", "#2563EB", "#FFFFFF");
        setTopMargin(btnCheckServer, 8);
        btnCheckServer.setOnClickListener(v -> handleTestServerConnection());
        serverCard.addView(btnCheckServer);

        txtServerCheckResult = new TextView(this);
        txtServerCheckResult.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        txtServerCheckResult.setTextColor(Color.parseColor("#52525B"));
        txtServerCheckResult.setText("위 파란색 버튼을 눌러 올클 서버와의 연결을 확인해보세요.");
        setTopMargin(txtServerCheckResult, 6);
        serverCard.addView(txtServerCheckResult);
        root.addView(serverCard);

        // 3. 사무실 문자수신기 제어 패널
        LinearLayout smsPanel = buildSmsPanel();
        setTopMargin(smsPanel, 12);
        root.addView(smsPanel);

        scroll.addView(root);
        setContentView(scroll);
    }

    private LinearLayout buildSmsPanel() {
        LinearLayout card = makeCard("#FFFFFF", "#E4E4E7");

        TextView stepLabel = makeLabel("STEP 2 · 사무실 문자 자동접수 가동");
        card.addView(stepLabel);

        txtSmsStatusBadge = new TextView(this);
        txtSmsStatusBadge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        txtSmsStatusBadge.setTypeface(Typeface.DEFAULT_BOLD);
        setTopMargin(txtSmsStatusBadge, 6);
        card.addView(txtSmsStatusBadge);

        TextView desc = new TextView(this);
        desc.setText("대표번호 유심이 꽂힌 사무실 공기계에서 켜두면, 수신되는 모든 고객 수거신청 문자(장문 LMS 포함)와 발신 전화번호를 누락 없이 올클 관리자 대시보드에 실시간 자동 등록합니다.");
        desc.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        desc.setTextColor(Color.parseColor("#52525B"));
        setTopMargin(desc, 4);
        card.addView(desc);

        TextView secLabel = makeLabel("웹훅 보안키 (기본값 자동 입력됨)");
        setTopMargin(secLabel, 12);
        card.addView(secLabel);

        inputSmsSecret = makeEditText("allclear-sms-secret-2026");
        inputSmsSecret.setText(AppPrefs.getSmsSecret(this));
        setTopMargin(inputSmsSecret, 4);
        card.addView(inputSmsSecret);

        btnToggleSmsMode = makeButton("🟢 문자 권한 허용 & 자동접수 시작 (ON)", "#059669", "#FFFFFF");
        setTopMargin(btnToggleSmsMode, 12);
        btnToggleSmsMode.setOnClickListener(v -> handleToggleSmsRelay());
        card.addView(btnToggleSmsMode);

        Button btnSendSample = makeButton("🧪 서버로 테스트 수거문자 즉시 발송해보기", "#EFF6FF", "#1D4ED8");
        setTopMargin(btnSendSample, 8);
        btnSendSample.setOnClickListener(v -> handleSendTestSmsToWebhook());
        card.addView(btnSendSample);

        Button btnBattery = makeButton("🔋 갤럭시 배터리 절전 예외 허용 (권장 1회)", "#F4F4F5", "#27272A");
        setTopMargin(btnBattery, 8);
        btnBattery.setOnClickListener(v -> requestIgnoreBatteryOptimizations());
        card.addView(btnBattery);

        txtSmsCounters = new TextView(this);
        txtSmsCounters.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        txtSmsCounters.setTypeface(Typeface.DEFAULT_BOLD);
        txtSmsCounters.setTextColor(Color.parseColor("#1E40AF"));
        setTopMargin(txtSmsCounters, 14);
        card.addView(txtSmsCounters);

        Button btnFlushQueue = makeButton("🔄 미전송 보관 문자 즉시 재전송", "#FAFAFA", "#52525B");
        setTopMargin(btnFlushQueue, 6);
        btnFlushQueue.setOnClickListener(v -> {
            SmsKeepAliveService.flushQueuedSmsAsync(this);
            Toast.makeText(this, "미전송 대기열 재전송을 요청했습니다.", Toast.LENGTH_SHORT).show();
        });
        card.addView(btnFlushQueue);

        TextView logHeader = makeLabel("최근 수신 · 자동접수 처리 내역");
        setTopMargin(logHeader, 12);
        card.addView(logHeader);

        txtSmsLogs = new TextView(this);
        txtSmsLogs.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        txtSmsLogs.setTextColor(Color.parseColor("#E4E4E7"));
        txtSmsLogs.setBackground(makeRoundedBg("#18181B", "#27272A", 10));
        txtSmsLogs.setPadding(dp(12), dp(10), dp(12), dp(10));
        setTopMargin(txtSmsLogs, 6);
        card.addView(txtSmsLogs);

        return card;
    }

    private void saveCurrentInputs() {
        if (inputServerUrl != null) {
            AppPrefs.setServerUrl(this, inputServerUrl.getText().toString());
        }
        if (inputSmsSecret != null) {
            AppPrefs.setSmsSecret(this, inputSmsSecret.getText().toString());
        }
    }

    private void handleTestServerConnection() {
        saveCurrentInputs();
        final String serverUrl = AppPrefs.getServerUrl(this);
        final String secret = AppPrefs.getSmsSecret(this);
        inputServerUrl.setText(serverUrl);
        txtServerCheckResult.setText("서버 연결 확인 중...");
        txtServerCheckResult.setTextColor(Color.parseColor("#2563EB"));

        new Thread(() -> {
            ApiClient.ApiResult res = ApiClient.pingSmsServer(serverUrl, secret);
            runOnUiThread(() -> {
                if (res.ok) {
                    String msg = "✅ 올클 서버 연결 성공!";
                    try {
                        JSONObject j = new JSONObject(res.body);
                        msg = "✅ " + j.optString("message", "올클 서버 연결 정상");
                    } catch (Exception ignored) {
                    }
                    txtServerCheckResult.setText(msg);
                    txtServerCheckResult.setTextColor(Color.parseColor("#059669"));
                } else {
                    txtServerCheckResult.setText("❌ 연결 실패 (" + res.errorMessage + ") — 인터넷 연결 또는 서버 주소를 확인해주세요.");
                    txtServerCheckResult.setTextColor(Color.parseColor("#DC2626"));
                }
            });
        }).start();
    }

    private void handleToggleSmsRelay() {
        saveCurrentInputs();
        if (AppPrefs.isSmsEnabled(this)) {
            AppPrefs.setSmsEnabled(this, false);
            SmsKeepAliveService.stopServiceSafe(this);
            AppPrefs.appendSmsLog(this, "⏹ 사무실 문자 자동접수를 중지했습니다.");
            renderStateFromPrefs();
            return;
        }

        List<String> needed = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.RECEIVE_SMS);
        }
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS);
        }

        if (!needed.isEmpty()) {
            requestPermissions(needed.toArray(new String[0]), REQ_PERMS_SMS);
            return;
        }

        enableSmsRelayNow();
    }

    private void enableSmsRelayNow() {
        AppPrefs.setSmsEnabled(this, true);
        SmsKeepAliveService.startServiceSafe(this);
        AppPrefs.appendSmsLog(this, "🟢 사무실 문자 자동접수 가동 시작 (서버: " + AppPrefs.getServerUrl(this) + ")");
        renderStateFromPrefs();
        Toast.makeText(this, "올클 문자 자동접수가 시작되었습니다!", Toast.LENGTH_SHORT).show();
    }

    private void handleSendTestSmsToWebhook() {
        saveCurrentInputs();
        final String serverUrl = AppPrefs.getServerUrl(this);
        final String secret = AppPrefs.getSmsSecret(this);
        Toast.makeText(this, "테스트 수거문자를 올클 서버로 전송합니다...", Toast.LENGTH_SHORT).show();

        new Thread(() -> {
            String sampleText = "[전용앱 테스트] 경기도 수원시 영통구 광교중앙로 145 102동 1503호 헌옷 30kg 내일 비대면 수거 신청합니다.";
            ApiClient.ApiResult res = ApiClient.forwardSmsToWebhook(
                    serverUrl,
                    secret,
                    "010-9988-7766",
                    sampleText
            );
            runOnUiThread(() -> {
                if (res.ok) {
                    AppPrefs.incrementSmsForwardedCount(this);
                    AppPrefs.appendSmsLog(this, "🧪 테스트 문자 서버 등록 완료! 올클 관리자 대시보드를 확인하세요.");
                    Toast.makeText(this, "등록 성공! 관리자 대시보드 신규 수거 요청을 확인하세요.", Toast.LENGTH_LONG).show();
                } else {
                    AppPrefs.appendSmsLog(this, "❌ 테스트 문자 전송 실패: " + res.errorMessage);
                    Toast.makeText(this, "전송 실패: " + res.errorMessage, Toast.LENGTH_LONG).show();
                }
                renderStateFromPrefs();
            });
        }).start();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_PERMS_SMS) {
            if (checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED) {
                enableSmsRelayNow();
            } else {
                showRestrictedSmsPermissionGuideDialog();
            }
        }
    }

    /**
     * 왜 Android 13/14+ 전용 안내 다이얼로그를 띄우는가:
     * 플레이스토어가 아닌 직접 다운로드(.apk)로 설치한 앱은 안드로이드 보안 정책상
     * [앱 정보 -> 우측 상단 ⋮ -> 제한된 설정 허용]을 먼저 눌러야 SMS 권한 스위치가 활성화됩니다.
     */
    private void showRestrictedSmsPermissionGuideDialog() {
        new AlertDialog.Builder(this)
                .setTitle("문자(SMS) 권한 허용 안내")
                .setMessage("갤럭시(Android 13 이상)에서 직접 설치한 APK는 아래 순서로 1회 허용해주셔야 문자 자동접수가 작동합니다.\n\n"
                        + "1. 아래 [앱 설정 열기] 터치\n"
                        + "2. 우측 상단 점 3개 [⋮] 메뉴 → [제한된 설정 허용] 선택\n"
                        + "3. [권한] → [SMS] → [허용] 체크 후 앱으로 복귀")
                .setNegativeButton("닫기", null)
                .setPositiveButton("앱 설정 열기", (d, w) -> {
                    try {
                        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                        intent.setData(Uri.fromParts("package", getPackageName(), null));
                        startActivity(intent);
                    } catch (Exception e) {
                        Toast.makeText(this, "설정 화면을 열 수 없습니다.", Toast.LENGTH_SHORT).show();
                    }
                })
                .show();
    }

    private void requestIgnoreBatteryOptimizations() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                i.setData(Uri.parse("package:" + getPackageName()));
                startActivity(i);
            } else {
                Toast.makeText(this, "이미 배터리 절전 예외가 적용되어 있습니다.", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "설정 화면을 열 수 없습니다.", Toast.LENGTH_SHORT).show();
        }
    }

    private void renderStateFromPrefs() {
        boolean smsOn = AppPrefs.isSmsEnabled(this);
        if (smsOn) {
            txtSmsStatusBadge.setText("🟢 현재 상태: 사무실 문자 자동접수 가동 중 (상시 수신)");
            txtSmsStatusBadge.setTextColor(Color.parseColor("#059669"));
            btnToggleSmsMode.setText("⏹ 문자 자동접수 중지하기 (OFF)");
            styleButton(btnToggleSmsMode, "#DC2626", "#FFFFFF");
        } else {
            txtSmsStatusBadge.setText("⚪ 현재 상태: 대기 중 (아래 초록색 시작 버튼을 눌러주세요)");
            txtSmsStatusBadge.setTextColor(Color.parseColor("#71717A"));
            btnToggleSmsMode.setText("🟢 문자 권한 허용 & 자동접수 시작 (ON)");
            styleButton(btnToggleSmsMode, "#059669", "#FFFFFF");
        }
        txtSmsCounters.setText("누적 서버 전달: " + AppPrefs.getSmsForwardedCount(this)
                + "건  ·  미전송 재시도 대기: " + AppPrefs.getQueuedSmsCount(this) + "건");
        txtSmsLogs.setText(AppPrefs.getSmsLogs(this));
    }

    // ================= UI 유틸리티 =================

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                v,
                getResources().getDisplayMetrics()
        ));
    }

    private void setTopMargin(View view, int dpVal) {
        LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) view.getLayoutParams();
        if (lp == null) {
            lp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            );
        }
        lp.topMargin = dp(dpVal);
        view.setLayoutParams(lp);
    }

    private GradientDrawable makeRoundedBg(String fillHex, String strokeHex, int radiusDp) {
        GradientDrawable gd = new GradientDrawable();
        gd.setColor(Color.parseColor(fillHex));
        gd.setCornerRadius(dp(radiusDp));
        if (strokeHex != null) {
            gd.setStroke(dp(1), Color.parseColor(strokeHex));
        }
        return gd;
    }

    private LinearLayout makeCard(String fillHex, String strokeHex) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setBackground(makeRoundedBg(fillHex, strokeHex, 14));
        int p = dp(15);
        box.setPadding(p, p, p, p);
        return box;
    }

    private TextView makeLabel(String text) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setTextColor(Color.parseColor("#27272A"));
        return tv;
    }

    private EditText makeEditText(String hint) {
        EditText et = new EditText(this);
        et.setHint(hint);
        et.setSingleLine(true);
        et.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        et.setTextColor(Color.parseColor("#18181B"));
        et.setHintTextColor(Color.parseColor("#A1A1AA"));
        et.setBackground(makeRoundedBg("#FAFAFA", "#D4D4D8", 10));
        et.setPadding(dp(12), dp(10), dp(12), dp(10));
        return et;
    }

    private Button makeButton(String text, String bgHex, String fgHex) {
        Button btn = new Button(this);
        btn.setText(text);
        btn.setAllCaps(false);
        btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        btn.setTypeface(Typeface.DEFAULT_BOLD);
        btn.setGravity(Gravity.CENTER);
        btn.setMinHeight(dp(46));
        styleButton(btn, bgHex, fgHex);
        return btn;
    }

    private void styleButton(Button btn, String bgHex, String fgHex) {
        btn.setTextColor(Color.parseColor(fgHex));
        btn.setBackground(makeRoundedBg(bgHex, null, 10));
    }
}
