import type { CSSProperties, ImgHTMLAttributes } from 'react';
import type { IconBaseProps, IconType } from 'react-icons';

export const STORYBORED_LOGO_ASSETS = {
  appIcon: '/images/storybored/logo/appicon.svg',
  colorMark: '/images/storybored/logo/color-logo.svg',
  colorWordmark: '/images/storybored/logo/color-logo-mark.svg',
  darkMark: '/images/storybored/logo/dark-logo.svg',
  darkWordmark: '/images/storybored/logo/dark-logo-mark.svg',
  favicon: '/images/storybored/logo/favicon.svg',
  invertedMark: '/images/storybored/logo/inverted-logo.svg',
  invertedWordmark: '/images/storybored/logo/inverted-logo-mark.svg',
} as const;

type StoryBoredWordmarkVariant = 'color' | 'dark' | 'inverted';

const wordmarkSrcByVariant: Record<StoryBoredWordmarkVariant, string> = {
  color: STORYBORED_LOGO_ASSETS.colorWordmark,
  dark: STORYBORED_LOGO_ASSETS.darkWordmark,
  inverted: STORYBORED_LOGO_ASSETS.invertedWordmark,
};

interface StoryBoredWordmarkProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'src'> {
  alt?: string;
  variant?: StoryBoredWordmarkVariant;
}

export function StoryBoredWordmark({
  alt = 'StoryBored',
  variant = 'color',
  ...props
}: StoryBoredWordmarkProps) {
  return <img alt={alt} src={wordmarkSrcByVariant[variant]} {...props} />;
}

export const StoryBoredLogoMarkIcon: IconType = ({
  className,
  size,
  style,
  title,
}: IconBaseProps & { style?: CSSProperties }) => {
  const dimension = size ?? '1em';

  return (
    <img
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      className={className}
      src={STORYBORED_LOGO_ASSETS.colorMark}
      style={{ width: dimension, height: dimension, objectFit: 'contain', ...style }}
    />
  );
};
