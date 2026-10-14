export type LoadingSceneProps = {
  reduced: boolean;
  preview: boolean;
  active: boolean;
  onReady: () => void;
  onComplete: () => void;
  onError: () => void;
};
