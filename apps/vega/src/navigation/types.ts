export type DrawerParamList = {
  Home: undefined;
  Explore: undefined;
  TV: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Spike: undefined;
  Main: undefined;
  Details: { itemId: string };
  Player: { videoId: string };
};
