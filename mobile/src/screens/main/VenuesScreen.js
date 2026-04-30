import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES } from '../../utils/constants';

// Placeholder screens - to be fully implemented
const VenuesScreen = ({ route, navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Venues Screen</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
  },
});

export default VenuesScreen;
