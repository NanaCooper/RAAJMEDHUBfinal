import React, { useRef } from 'react';
import { TouchableOpacity, Animated, StyleProp, ViewStyle } from 'react-native';

interface ScaleButtonProps {
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    disabled?: boolean;
}

export default function ScaleButton({ onPress, style, children, disabled }: ScaleButtonProps) {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
        Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 20 }).start();
    };
    const onPressOut = () => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
    };

    return (
        <TouchableOpacity
            activeOpacity={1}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onPress={onPress}
            disabled={disabled}
        >
            <Animated.View style={[style, { transform: [{ scale }] }]}>
                {children}
            </Animated.View>
        </TouchableOpacity>
    );
}
