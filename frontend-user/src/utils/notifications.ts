/**
 * Notification Utilities
 * Handles push notifications, sound effects, and browser notifications
 */

export interface NotificationOptions {
  title: string;
  message: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
}

class NotificationService {
  private permission: NotificationPermission = 'default';
  private audioContext: AudioContext | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return;
    }

    // Check current permission
    this.permission = Notification.permission;

    // Request permission if not granted
    if (this.permission === 'default') {
      this.permission = await Notification.requestPermission();
    }

    // Initialize audio context for sound effects
    if ('AudioContext' in window || 'webkitAudioContext' in window) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return false;
    }

    console.log('Requesting notification permission...');
    this.permission = await Notification.requestPermission();
    console.log('Permission result:', this.permission);
    return this.permission === 'granted';
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    return this.permission === 'granted';
  }

  /**
   * Show a browser notification
   */
  async showNotification(options: NotificationOptions): Promise<boolean> {
    console.log('Attempting to show notification...');
    console.log('Current permission:', this.permission);
    
    if (!this.isEnabled()) {
      console.warn('Notifications not permitted. Requesting permission...');
      const granted = await this.requestPermission();
      if (!granted) {
        console.error('User denied notification permission');
        return false;
      }
    }

    try {
      console.log('Creating notification with options:', options);
      const notification = new Notification(options.title, {
        body: options.message,
        icon: options.icon || '/favicon.ico',
        badge: options.badge,
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
      });

      console.log('Notification created successfully');

      // Auto-close after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  /**
   * Play notification sound
   */
  async playSound(frequency: number = 800, duration: number = 200): Promise<void> {
    console.log('Attempting to play notification sound...');
    
    // Try multiple methods for better browser compatibility
    const methods = [
      () => this.playWebAudioSound(frequency, duration),
      () => this.playHTML5Sound(),
      () => this.playBeepSound()
    ];

    for (const method of methods) {
      try {
        await method();
        console.log('Notification sound played successfully');
        return;
      } catch (error) {
        console.log('Sound method failed, trying next...', error);
        continue;
      }
    }
    
    console.warn('All sound methods failed');
  }

  /**
   * Web Audio API method
   */
  private async playWebAudioSound(frequency: number, duration: number): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    // Resume audio context if it's suspended
    if (this.audioContext.state === 'suspended') {
      console.log('Resuming suspended audio context...');
      await this.audioContext.resume();
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration / 1000);
  }

  /**
   * HTML5 Audio method
   */
  private async playHTML5Sound(): Promise<void> {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
    audio.volume = 0.3;
    await audio.play();
  }

  /**
   * Simple beep sound using oscillator
   */
  private async playBeepSound(): Promise<void> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1;

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 200);
  }

  /**
   * Show notification with sound
   */
  async showNotificationWithSound(options: NotificationOptions): Promise<boolean> {
    const success = await this.showNotification(options);
    
    if (success) {
      await this.playSound();
    }

    return success;
  }

  /**
   * Show different types of notifications
   */
  async showSuccessNotification(message: string): Promise<boolean> {
    return this.showNotification({
      title: 'Success',
      message,
      icon: '/icons/success.png',
      tag: 'success'
    });
  }

  async showErrorNotification(message: string): Promise<boolean> {
    return this.showNotification({
      title: 'Error',
      message,
      icon: '/icons/error.png',
      tag: 'error',
      requireInteraction: true
    });
  }

  async showInfoNotification(message: string): Promise<boolean> {
    return this.showNotification({
      title: 'Information',
      message,
      icon: '/icons/info.png',
      tag: 'info'
    });
  }

  async showWarningNotification(message: string): Promise<boolean> {
    return this.showNotification({
      title: 'Warning',
      message,
      icon: '/icons/warning.png',
      tag: 'warning'
    });
  }

  /**
   * Test notification functionality
   */
  async testNotification(): Promise<boolean> {
    const success = await this.showNotificationWithSound({
      title: 'Test Notification',
      message: 'This is a test notification to verify the system is working properly.',
      tag: 'test'
    });

    return success;
  }
}

// Create singleton instance
export const notificationService = new NotificationService();

// Export for use in components
export default notificationService; 