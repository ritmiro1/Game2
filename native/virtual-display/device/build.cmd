@echo off
rem Run from an x64 Native Tools Command Prompt for VS 2022 or newer.
cl /nologo /W4 /EHsc /std:c++17 /DUNICODE /D_UNICODE main.cpp /Fe:LifeOSDisplayDevice.exe /link Swdevice.lib
