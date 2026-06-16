import React, { useRef } from 'react';
import { View, Modal, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function BottomSheet({
  visible,
  onDismiss,
  children,
}: {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const { bottom: safeBottom } = useSafeAreaInsets();

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }).start();
    } else {
      slideAnim.setValue(600);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <TouchableOpacity
        style={s.overlay}
        onPress={onDismiss}
        activeOpacity={1}
      />
      <Animated.View
        style={[
          s.sheet,
          { paddingBottom: Math.max(safeBottom, 16) },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={s.dragHandle} />
        {children}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 12,
  },
});
