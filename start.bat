@echo off
chcp 65001 > nul
title League Background Changer

:: Проверка наличия Node.js в системе
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не установлен!
    echo Для работы этой программы требуется Node.js версии 18 или новее.
    echo Пожалуйста, скачайте и установите Node.js LTS с официального сайта:
    echo https://nodejs.org/
    echo.
    echo Нажмите любую клавишу, чтобы открыть официальный сайт Node.js...
    pause >nul
    start https://nodejs.org/
    exit /b
)

:: Проверка версии Node.js (требуется версия >= 18 для поддержки встроенного fetch)
node -e "if (parseInt(process.versions.node.split('.')[0]) < 18) process.exit(1);" >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Ваша версия Node.js устарела!
    echo Для работы программы требуется Node.js версии 18 или выше.
    echo Текущая установленная версия:
    node -v
    echo.
    echo Пожалуйста, обновите Node.js с официального сайта: https://nodejs.org/
    echo Нажмите любую клавишу, чтобы открыть официальный сайт...
    pause >nul
    start https://nodejs.org/
    exit /b
)

:: Запуск утилиты
echo [INFO] Запуск League Background Changer...
echo.
node index.js

if %errorlevel% neq 0 (
    echo.
    echo [ОШИБКА] Программа завершилась некорректно.
    pause
)
