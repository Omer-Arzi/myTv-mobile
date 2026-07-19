import { Alert, AlertButton, Platform } from 'react-native';
import { showWebAlert } from '../components/WebAlertHost';

interface AppAlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

// Drop-in replacement for Alert.alert used at every call site in this app.
// Native iOS/Android: forwards straight to the real system Alert, unchanged.
// Web: routed to WebAlertHost's themed modal instead, since react-native-web's
// Alert.alert is an unstyled window.alert/confirm shim that can't represent
// 3+ custom buttons (see WebAlertHost.tsx for why).
export function appAlert(title: string, message?: string, buttons?: AlertButton[], options?: AppAlertOptions) {
  if (Platform.OS === 'web') {
    showWebAlert(title, message, buttons, options);
  } else {
    Alert.alert(title, message, buttons, options);
  }
}
