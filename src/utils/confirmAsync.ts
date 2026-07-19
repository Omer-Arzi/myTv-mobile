import { AlertButton } from 'react-native';
import { appAlert } from './appAlert';

// Promise-wraps Alert.alert's callback-based API so a multi-step
// confirm -> act -> (maybe) force-retry flow can be written as sequential
// async/await instead of nested callbacks. Shared by SeriesDetailScreen and
// UpcomingTimeline — both need the exact same confirm-then-continue shape.
export function confirmAsync(title: string, message: string, confirmText: string): Promise<boolean> {
  return new Promise((resolve) => {
    const buttons: AlertButton[] = [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, onPress: () => resolve(true) },
    ];
    appAlert(title, message, buttons, { cancelable: true, onDismiss: () => resolve(false) });
  });
}
