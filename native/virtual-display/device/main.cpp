// LifeOS software-device host. Adapted from Microsoft's MIT-licensed IddSampleApp.
// This DOES NOT install a driver, change signature enforcement, or disable Secure Boot.
#include <windows.h>
#include <swdevice.h>
#include <conio.h>
#include <cstdio>
#include <cstdlib>
struct CreationState { HANDLE event; HRESULT result = E_PENDING; };
static HANDLE stopEvent = nullptr;
static BOOL WINAPI OnConsole(DWORD) { if(stopEvent) SetEvent(stopEvent); return TRUE; }
static VOID WINAPI OnCreated(HSWDEVICE, HRESULT result, PVOID context, PCWSTR) {
    auto state = static_cast<CreationState*>(context); state->result = result; SetEvent(state->event);
}
int wmain(int argc, wchar_t* argv[]) {
    if(argc != 2 || wcscmp(argv[1], L"--enable") != 0) {
        puts("LifeOS Virtual Display — EXPERIMENTAL software-device host\n"
             "Requires a separately built, correctly signed and installed LifeOSVirtualDisplay driver.\n"
             "Usage on a disposable Windows test machine only: LifeOSDisplayDevice.exe --enable\n"
             "The device exists while this process runs. X, Ctrl+C, or 10 minutes removes it.\n"
             "This tool never disables driver signature checks or changes the primary monitor."); return 0;
    }
    CreationState state{CreateEventW(nullptr, TRUE, FALSE, nullptr)};
    stopEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if(!state.event || !stopEvent) { fputs("Cannot create synchronization events\n",stderr);return 1; }
    SetConsoleCtrlHandler(OnConsole, TRUE);
    SW_DEVICE_CREATE_INFO info{};info.cbSize=sizeof(info);
    info.pszInstanceId=L"LifeOSVirtualDisplay";info.pszzHardwareIds=L"LifeOSVirtualDisplay\0";
    info.pszzCompatibleIds=L"LifeOSVirtualDisplay\0";
    info.pszDeviceDescription=L"LifeOS Virtual Display (experimental)";
    info.CapabilityFlags=SWDeviceCapabilitiesRemovable|SWDeviceCapabilitiesDriverRequired;
    HSWDEVICE device=nullptr;
    HRESULT hr=SwDeviceCreate(L"LifeOSVirtualDisplay",L"HTREE\\ROOT\\0",&info,0,nullptr,OnCreated,&state,&device);
    if(FAILED(hr)) { fprintf(stderr,"SwDeviceCreate failed: 0x%08lx\n",hr);CloseHandle(state.event);CloseHandle(stopEvent);return 1; }
    if(WaitForSingleObject(state.event,15000)!=WAIT_OBJECT_0 || FAILED(state.result)) {
        fprintf(stderr,"Device creation not confirmed: 0x%08lx. Check signed driver installation.\n",state.result);
        SwDeviceClose(device);CloseHandle(state.event);CloseHandle(stopEvent);return 2;
    }
    puts("Software device created. This does NOT prove the driver started or that capture works.\n"
         "Check Windows Display Settings. Keep the physical monitor enabled and primary.\n"
         "Press X to remove the device. Automatic removal in 10 minutes.");
    const ULONGLONG end=GetTickCount64()+10*60*1000;
    while(GetTickCount64()<end && WaitForSingleObject(stopEvent,100)==WAIT_TIMEOUT) {
        if(_kbhit()){int key=_getch();if(key=='x'||key=='X')break;}
    }
    SwDeviceClose(device);CloseHandle(state.event);CloseHandle(stopEvent);return 0;
}
