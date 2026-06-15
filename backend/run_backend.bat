@echo off
title Backend Glifo
color 1F

echo ==========================================
echo    INICIANDO BACKEND GLIFO
echo ==========================================

:: Activar el entorno virtual e iniciar python run.py en una sola linea
call env\Scripts\activate && python run.py

pause