"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRequestStatusInSheet = exports.addRequestToSheet = void 0;
const google_spreadsheet_1 = require("google-spreadsheet");
const google_auth_library_1 = require("google-auth-library");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Initialize auth - see https://theoephraim.github.io/node-google-spreadsheet/#/guides/authentication
const serviceAccountAuth = new google_auth_library_1.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // 줄바꿈 문자를 실제 줄바꿈으로 처리
    key: (_a = process.env.GOOGLE_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const addRequestToSheet = (requestData) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const doc = new google_spreadsheet_1.GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
        yield doc.loadInfo(); // 문서 로드
        const sheet = doc.sheetsByIndex[0]; // 첫 번째 시트 선택
        // 시트의 헤더(첫 번째 행)를 자동으로 설정합니다.
        yield sheet.setHeaderRow(['ID', '신청인', '연락처', '기본주소', '상세주소', '희망일', '수거량', '상태', '신청일시', '실제수거무게(kg)', '특이사항']);
        yield sheet.addRow({
            'ID': requestData.id,
            '신청인': requestData.userName,
            '연락처': requestData.phone,
            '기본주소': requestData.address,
            '상세주소': requestData.detailAddress,
            '희망일': requestData.desiredDate,
            '수거량': requestData.estimatedVolume,
            '상태': requestData.status,
            '신청일시': new Date().toLocaleString('ko-KR')
        });
        console.log('✅ 구글 시트 데이터 추가 성공');
    }
    catch (error) {
        console.error('❌ 구글 시트 연동 실패:', ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message || error);
    }
});
exports.addRequestToSheet = addRequestToSheet;
const updateRequestStatusInSheet = (requestId, status, actualWeight, driverNote) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const doc = new google_spreadsheet_1.GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
        yield doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = yield sheet.getRows();
        const targetRow = rows.find(row => row.get('ID') === requestId);
        if (targetRow) {
            targetRow.assign({
                '상태': status,
            });
            if (actualWeight !== undefined)
                targetRow.assign({ '실제수거무게(kg)': actualWeight.toString() });
            if (driverNote !== undefined)
                targetRow.assign({ '특이사항': driverNote });
            yield targetRow.save();
            console.log(`✅ 구글 시트 데이터 업데이트 성공 (ID: ${requestId})`);
        }
        else {
            console.warn(`⚠️ 구글 시트 업데이트 실패: ID ${requestId} 를 찾을 수 없습니다.`);
        }
    }
    catch (error) {
        console.error('❌ 구글 시트 연동 실패:', ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message || error);
    }
});
exports.updateRequestStatusInSheet = updateRequestStatusInSheet;
