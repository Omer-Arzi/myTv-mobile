import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent } from 'react-native';

interface Props {
  exiting: boolean;
  onExited: () => void;
  children: React.ReactNode;
}

const EXIT_DURATION_MS = 240;

// Web-only fallback for the collapse/fade LayoutAnimation gives Watch Next
// card removal for free on native (LayoutAnimation is a no-op on
// react-native-web — see HomeScreen.tsx). Measures its own height on first
// layout, then — once `exiting` flips true — animates height and opacity
// down to 0 before calling onExited, which is when the caller actually
// removes the item from its list state. Not used for the "advance to next
// episode" in-place update, which has no removal to animate.
export function AnimatedExitWrapper({ exiting, onExited, children }: Props) {
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const progress = useRef(new Animated.Value(1)).current;

  const handleLayout = (event: LayoutChangeEvent) => {
    if (measuredHeight === null) setMeasuredHeight(event.nativeEvent.layout.height);
  };

  useEffect(() => {
    if (!exiting || measuredHeight === null) return;
    Animated.timing(progress, {
      toValue: 0,
      duration: EXIT_DURATION_MS,
      useNativeDriver: false, // animating height, which the native driver can't handle
    }).start(({ finished }) => {
      if (finished) onExited();
    });
  }, [exiting, measuredHeight, onExited, progress]);

  if (measuredHeight === null) {
    return <Animated.View onLayout={handleLayout}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      style={{
        height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, measuredHeight] }),
        opacity: progress,
        overflow: 'hidden',
      }}
    >
      {children}
    </Animated.View>
  );
}
