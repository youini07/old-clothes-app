@echo off
echo =========================================
echo       Deploy Script Started
echo =========================================
echo.

echo [1/1] Pushing code to GitHub...
echo This will automatically trigger deployment on Vercel and Railway.
echo.

git add .
git commit -m "Auto deploy from local script"
git push

if %errorlevel% neq 0 (
    echo [ERROR] Git push failed. Please check your git configuration.
    pause
    exit /b %errorlevel%
)

echo.
echo [SUCCESS] Code pushed to GitHub!
echo Vercel and Railway will now build and deploy the latest changes.
echo.
echo =========================================
echo       All Deployments Completed!
echo =========================================
pause
