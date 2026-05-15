@echo off
echo =========================================
echo   HVAC Cost Estimator - Starting Up...
echo =========================================
echo.

:: Check if .env exists
if not exist "backend\.env" (
  echo [SETUP] Copying .env.example to .env
  echo Please open backend\.env and add your ANTHROPIC_API_KEY
  copy "backend\.env.example" "backend\.env"
  echo.
)

:: Install backend dependencies if needed
if not exist "backend\node_modules" (
  echo [SETUP] Installing backend dependencies...
  cd backend
  call npm install
  cd ..
  echo.
)

:: Install frontend dependencies if needed
if not exist "frontend\node_modules" (
  echo [SETUP] Installing frontend dependencies...
  cd frontend
  call npm install
  cd ..
  echo.
)

echo [INFO] Starting Backend on http://localhost:3001
start "HVAC Backend" cmd /k "cd backend && npm run dev"

echo [INFO] Starting Frontend on http://localhost:5173
timeout /t 2 /nobreak >nul
start "HVAC Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo =========================================
echo   App running at http://localhost:5173
echo =========================================
