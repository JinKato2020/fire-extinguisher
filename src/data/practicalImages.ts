import type { ImageSourcePropType } from 'react-native';

// Included in the Expo update, so question images also work without a network.
export const practicalImages: Record<string, ImageSourcePropType> = {
  powder: require('../../assets/figures/practical_powder.jpg'),
  co2: require('../../assets/figures/practical_co2.jpg'),
  gauges: require('../../assets/figures/practical_gauges.jpg'),
  cap: require('../../assets/figures/practical_cap.jpg'),
  tools: require('../../assets/figures/practical_tools.jpg'),
  fires: require('../../assets/figures/practical_fires.jpg'),
};
