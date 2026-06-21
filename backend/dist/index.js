"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const requests_1 = __importDefault(require("./routes/requests"));
const admin_1 = __importDefault(require("./routes/admin"));
const driver_1 = __importDefault(require("./routes/driver"));
const errorHandler_1 = require("./middleware/errorHandler");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '20mb' }));
app.use(express_1.default.urlencoded({ limit: '20mb', extended: true }));
// 라우터 등록
app.use('/api/auth', auth_1.default);
app.use('/api/requests', requests_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/driver', driver_1.default);
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running!' });
});
// 글로벌 에러 핸들러 (반드시 모든 라우트 아래에 위치)
app.use(errorHandler_1.globalErrorHandler);
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
