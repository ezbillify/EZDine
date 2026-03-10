const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// White labeling app metadata
app.name = 'EZDine';
app.setAppUserModelId('com.ezdine.pos');

app.setName('EZDine');
if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, 'assets', 'icon.png'));
}

let mainWindow;
let pyProc = null;
let pyPort = 8080; // Default, will be updated to a dynamic free port

// Find the local IP address
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}

const localIp = getLocalIpAddress();

// Determine the executable for the current platform
function getBridgeExecutable() {
    return os.platform() === 'win32'
        ? 'ezdine-print-bridge-win.exe'
        : 'ezdine-print-bridge-macos';
}

function createPyProc() {
    const binaryName = getBridgeExecutable();
    let scriptPath = path.join(__dirname, 'bridge', binaryName);

    // When packaged, resources might be in process.resourcesPath
    if (!fs.existsSync(scriptPath)) {
        scriptPath = path.join(process.resourcesPath, 'bridge', binaryName);
    }

    console.log('Starting Print Bridge Binary:', scriptPath);

    if (!fs.existsSync(scriptPath)) {
        console.error(`ERROR: Could not find ${binaryName}!`);
        return;
    }

    // Use fixed port 4000 to match Web POS default settings
    pyPort = 4000;

    // Execute the standalone binary directly, passing the port as the first argument
    pyProc = spawn(scriptPath, [pyPort.toString()], {
        // Ensure the binary is executable on Unix
        stdio: 'pipe'
    });

    pyProc.stdout.on('data', (data) => {
        console.log(`PrintBridge: ${data.toString()}`);
    });

    pyProc.stderr.on('data', (data) => {
        console.error(`PrintBridge Error: ${data.toString()}`);
    });

    pyProc.on('close', (code) => {
        console.log(`PrintBridge exited with code ${code}`);
        pyProc = null;
    });
}

function exitPyProc() {
    if (pyProc != null) {
        // kill logic
        if (os.platform() === 'win32') {
            spawn("taskkill", ["/pid", pyProc.pid, '/f', '/t']);
        } else {
            pyProc.kill('SIGINT');
        }
        pyProc = null;
    }
}

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: Math.floor(width * 0.9),
        height: Math.floor(height * 0.9),
        minWidth: 1024,
        minHeight: 768,
        show: false, // Don't show until ready-to-show to prevent flickering
        title: "EZDine POS",
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true, // Recommended for production
            allowRunningInsecureContent: false,
            webviewTag: true,
        }
    });

    // Enable autoplay so KOT sounds ring even without interaction
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.setAudioMuted(false);
    });

    mainWindow.maximize();

    // Load the local wrapper HTML
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createMenu() {
    const template = [
        ...(process.platform === 'darwin' ? [{
            label: 'EZDine POS',
            submenu: [
                { role: 'about', label: 'About EZDine POS' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide', label: 'Hide EZDine POS' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit', label: 'Quit EZDine POS' }
            ]
        }] : []),
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forcereload' },
                { role: 'toggledevtools' },
                { type: 'separator' },
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            role: 'window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click: async () => {
                        const { shell } = require('electron');
                        await shell.openExternal('https://ezdine.ezbillify.com');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    createPyProc();
    createWindow();
    createMenu();

    // Automatically check for updates and notify the user to install them when ready
    autoUpdater.checkForUpdatesAndNotify();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
            createMenu();
        }
    });
});

app.on('will-quit', exitPyProc);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handler to send the bridge config to the renderer
ipcMain.handle('get-bridge-info', () => {
    return {
        ip: localIp,
        port: pyPort,
        url: `http://${localIp}:${pyPort}`,
        appUrl: process.env.LOCAL_DEV ? 'http://localhost:3000' : 'https://ezdine.ezbillify.com'
    };
});

ipcMain.handle('print-job', async (event, job) => {
    const http = require('http');
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(job);
        const options = {
            hostname: '127.0.0.1',
            port: pyPort,
            path: '/print',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(true);
                } else {
                    reject(new Error(`Bridge error: ${res.statusCode} ${body}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(data);
        req.end();
    });
});
