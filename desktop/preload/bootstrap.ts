import { contextBridge, ipcRenderer } from 'electron';
import { createLauncherBridge } from './index.js';

contextBridge.exposeInMainWorld('serenityLauncher', createLauncherBridge((channel, payload) => (
  payload === undefined ? ipcRenderer.invoke(channel) : ipcRenderer.invoke(channel, payload)
)));
