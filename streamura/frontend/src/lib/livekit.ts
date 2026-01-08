/**
 * LiveKit Client Setup
 *
 * Handles LiveKit room connections and token management.
 */

import {
  Room,
  RoomEvent,
  ConnectionState,
  type RemoteParticipant,
  type Track,
  type TrackPublication,
} from 'livekit-client';
import { api } from './api';

// LiveKit server URL from environment
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';

// Token fetch functions
export async function fetchBroadcastToken(streamId: number): Promise<{
  roomName: string;
  token: string;
  livekitUrl: string;
}> {
  const response = await api.post<{
    room_name: string;
    token: string;
    livekit_url: string;
  }>(`/streams/${streamId}/broadcast-token`);

  return {
    roomName: response.data.room_name,
    token: response.data.token,
    livekitUrl: response.data.livekit_url || LIVEKIT_URL,
  };
}

export async function fetchViewerToken(streamId: number): Promise<{
  roomName: string;
  token: string;
  livekitUrl: string;
}> {
  const response = await api.post<{
    room_name: string;
    token: string;
    livekit_url: string;
  }>(`/streams/${streamId}/viewer-token`);

  return {
    roomName: response.data.room_name,
    token: response.data.token,
    livekitUrl: response.data.livekit_url || LIVEKIT_URL,
  };
}

// Room connection options
export const defaultRoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: {
      width: 1280,
      height: 720,
      frameRate: 30,
    },
  },
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

// Create a new LiveKit room instance
export function createRoom(): Room {
  return new Room(defaultRoomOptions);
}

// Event handler types
export interface RoomEventHandlers {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onParticipantConnected?: (participant: RemoteParticipant) => void;
  onParticipantDisconnected?: (participant: RemoteParticipant) => void;
  onTrackSubscribed?: (
    track: Track,
    publication: TrackPublication,
    participant: RemoteParticipant
  ) => void;
  onTrackUnsubscribed?: (
    track: Track,
    publication: TrackPublication,
    participant: RemoteParticipant
  ) => void;
  onConnectionStateChanged?: (state: ConnectionState) => void;
}

// Setup room event listeners
export function setupRoomEventListeners(
  room: Room,
  handlers: RoomEventHandlers
): () => void {
  const {
    onConnected,
    onDisconnected,
    onParticipantConnected,
    onParticipantDisconnected,
    onTrackSubscribed,
    onTrackUnsubscribed,
    onConnectionStateChanged,
  } = handlers;

  if (onConnected) {
    room.on(RoomEvent.Connected, onConnected);
  }

  if (onDisconnected) {
    room.on(RoomEvent.Disconnected, onDisconnected);
  }

  if (onParticipantConnected) {
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
  }

  if (onParticipantDisconnected) {
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
  }

  if (onTrackSubscribed) {
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
  }

  if (onTrackUnsubscribed) {
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
  }

  if (onConnectionStateChanged) {
    room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
  }

  // Return cleanup function
  return () => {
    if (onConnected) room.off(RoomEvent.Connected, onConnected);
    if (onDisconnected) room.off(RoomEvent.Disconnected, onDisconnected);
    if (onParticipantConnected)
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
    if (onParticipantDisconnected)
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    if (onTrackSubscribed)
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
    if (onTrackUnsubscribed)
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    if (onConnectionStateChanged)
      room.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
  };
}

// Connect to a room as broadcaster
export async function connectAsBroadcaster(
  room: Room,
  streamId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { token, livekitUrl } = await fetchBroadcastToken(streamId);

    await room.connect(livekitUrl, token);

    // Enable camera and microphone
    await room.localParticipant.setCameraEnabled(true);
    await room.localParticipant.setMicrophoneEnabled(true);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return { success: false, error: message };
  }
}

// Connect to a room as viewer
export async function connectAsViewer(
  room: Room,
  streamId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { token, livekitUrl } = await fetchViewerToken(streamId);

    await room.connect(livekitUrl, token);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return { success: false, error: message };
  }
}

// Disconnect from room
export async function disconnectFromRoom(room: Room): Promise<void> {
  await room.disconnect();
}

// Get participant count
export function getParticipantCount(room: Room): number {
  // +1 for local participant
  return room.remoteParticipants.size + 1;
}

// Check if room is connected
export function isRoomConnected(room: Room): boolean {
  return room.state === ConnectionState.Connected;
}

// Media controls
export async function toggleCamera(room: Room): Promise<boolean> {
  const enabled = room.localParticipant.isCameraEnabled;
  await room.localParticipant.setCameraEnabled(!enabled);
  return !enabled;
}

export async function toggleMicrophone(room: Room): Promise<boolean> {
  const enabled = room.localParticipant.isMicrophoneEnabled;
  await room.localParticipant.setMicrophoneEnabled(!enabled);
  return !enabled;
}

export async function toggleScreenShare(room: Room): Promise<boolean> {
  const enabled = room.localParticipant.isScreenShareEnabled;
  await room.localParticipant.setScreenShareEnabled(!enabled);
  return !enabled;
}

// Get available media devices
export async function getAvailableDevices(): Promise<{
  videoDevices: MediaDeviceInfo[];
  audioDevices: MediaDeviceInfo[];
}> {
  const devices = await navigator.mediaDevices.enumerateDevices();

  return {
    videoDevices: devices.filter((d) => d.kind === 'videoinput'),
    audioDevices: devices.filter((d) => d.kind === 'audioinput'),
  };
}

// Switch camera device
export async function switchCamera(
  room: Room,
  deviceId: string
): Promise<void> {
  await room.switchActiveDevice('videoinput', deviceId);
}

// Switch microphone device
export async function switchMicrophone(
  room: Room,
  deviceId: string
): Promise<void> {
  await room.switchActiveDevice('audioinput', deviceId);
}
