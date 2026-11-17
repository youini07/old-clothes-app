package com.allclear.app;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * 올클(ALL-CLEAR) 백엔드 API 통신 전용 경량 HTTP 클라이언트
 *
 * [왜 표준 HttpURLConnection을 사용하는가]
 * 외부 서드파티 라이브러리 의존성을 0으로 유지해 APK 용량을 초경량으로 만들고,
 * 안드로이드 전 버전(8.0~15)에서 호환성 충돌 없이 즉시 작동하도록 설계했습니다.
 */
public final class ApiClient {

    public static class ApiResult {
        public final boolean ok;
        public final int statusCode;
        public final String body;
        public final String errorMessage;

        public ApiResult(boolean ok, int statusCode, String body, String errorMessage) {
            this.ok = ok;
            this.statusCode = statusCode;
            this.body = body;
            this.errorMessage = errorMessage;
        }
    }

    private ApiClient() {}

    public static ApiResult pingSmsServer(String serverUrl, String secret) {
        try {
            String base = AppPrefs.normalizeServerUrl(serverUrl);
            String fullUrl = base + "/api/sms/ping?secret=" + URLEncoder.encode(secret, "UTF-8");
            return executeRequest("GET", fullUrl, null, secret);
        } catch (Exception e) {
            return new ApiResult(false, 0, "", e.getMessage());
        }
    }

    public static ApiResult forwardSmsToWebhook(
            String serverUrl,
            String secret,
            String senderPhone,
            String messageText
    ) {
        try {
            String base = AppPrefs.normalizeServerUrl(serverUrl);
            JSONObject payload = new JSONObject();
            payload.put("from", senderPhone);
            payload.put("text", messageText);
            payload.put("secret", secret);
            return executeRequest("POST", base + "/api/sms/webhook", payload.toString(), secret);
        } catch (Exception e) {
            return new ApiResult(false, 0, "", e.getMessage());
        }
    }

    private static ApiResult executeRequest(
            String method,
            String urlStr,
            String jsonBody,
            String webhookSecret
    ) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod(method);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(12000);
            conn.setRequestProperty("Accept", "application/json");
            if (webhookSecret != null && !webhookSecret.isEmpty()) {
                conn.setRequestProperty("x-webhook-secret", webhookSecret);
            }

            if (jsonBody != null && "POST".equalsIgnoreCase(method)) {
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                byte[] bytes = jsonBody.getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bytes);
                    os.flush();
                }
            }

            int code = conn.getResponseCode();
            InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
            StringBuilder sb = new StringBuilder();
            if (is != null) {
                try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        sb.append(line);
                    }
                }
            }
            String respText = sb.toString();
            boolean success = code >= 200 && code < 300;
            String errMsg = null;
            if (!success) {
                try {
                    JSONObject errJson = new JSONObject(respText);
                    errMsg = errJson.optString("error", "HTTP " + code);
                } catch (Exception ignored) {
                    errMsg = "HTTP " + code;
                }
            }
            return new ApiResult(success, code, respText, errMsg);
        } catch (Exception e) {
            return new ApiResult(false, 0, "", "연결 실패: " + e.getMessage());
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }
}
