import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { WatchlistScreen } from '../screens/WatchlistScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SystemScreen } from '../screens/SystemScreen';
import { TabParamList } from './types';
import { colors } from '../theme/theme';

const Tab = createBottomTabNavigator<TabParamList>();

// Headers are turned off here on purpose — each screen renders its own
// SectionHeader-based layout via <Screen>, and a plain native "Home" /
// "Watchlist" title bar on top of that would just be a second, redundant
// header (and would double up on top safe-area padding — <Screen> already
// accounts for the notch itself when there's no native header above it).
export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        // lineHeight is explicit — @react-navigation/bottom-tabs' own
        // default label style (BottomTabItem.tsx's styles.labelBeneath) is
        // `{ fontSize: 10 }` with NO lineHeight set, so it inherits whatever
        // line box react-native-web sizes for that smaller default.
        // Overriding fontSize here (11, not 10) without also setting
        // lineHeight left descenders (the "y" in "System", the tail of the
        // "t" in "Watchlist") clipped at the bottom, inside the Label
        // component's numberOfLines={1} truncation box — confirmed via a
        // real-device screenshot showing exactly those two labels (both
        // have descenders) cut off while "Home"/"Search" (neither does)
        // rendered fine.
        //
        // The label's own requested line box isn't free to grow, though —
        // measured directly (real DOM): the tab item's total height is
        // fixed at 48px (49 + insets.bottom, see BottomTabBar.tsx), and
        // that 48px is split between the icon (28px, TabBarIcon.tsx's
        // hardcoded ICON_SIZE_TALL) and the library's own default vertical
        // padding (5+5=10px) BEFORE the label ever gets a share — leaving
        // only 48-10-28=10px, a hard flex-shrink ceiling no lineHeight can
        // exceed on its own. That padding lives on BottomTabItem's inner
        // `<a role="tab">` button (styles.tab/tabVerticalUiKit), which is a
        // different DOM node than the one `tabBarItemStyle` below actually
        // reaches (BottomTabItem's OUTER wrapping `<View>`) — so padding
        // can't be freed from this screen's options at all, only the icon
        // can. tabBarIconStyle below IS applied (as a later array entry)
        // directly to TabBarIcon's own sizing View, so its height can be
        // overridden here: shrinking it 28 -> 24 frees 4px (48-10-24=14),
        // enough for a 14px label line box. The icon glyph itself still
        // renders at its own fixed 25px (TabBarIcon.tsx computes that
        // separately, unaffected by this wrapper override) and its
        // containing View has no overflow:hidden anywhere up the chain, so
        // it's simply centered in a slightly smaller box — not clipped.
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
        tabBarIconStyle: { height: 24 },
        // minWidth: 0 overrides the browser's flexbox default (min-width:
        // auto, which lets intrinsic text width win over the flex item's
        // allotted space) — without it, react-native-web's numberOfLines={1}
        // truncation on the tab label (set by @react-navigation/elements'
        // Label component) isn't reliably honored, and our longest label
        // ("Watchlist") can overflow/clip instead of ellipsizing to fit its
        // tab item's width.
        tabBarItemStyle: { minWidth: 0 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarButtonTestID: 'tab-button-home',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Watchlist"
        component={WatchlistScreen}
        options={{
          tabBarButtonTestID: 'tab-button-watchlist',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'tv' : 'tv-outline'} size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarButtonTestID: 'tab-button-search',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="System"
        component={SystemScreen}
        options={{
          tabBarButtonTestID: 'tab-button-system',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'hardware-chip' : 'hardware-chip-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
