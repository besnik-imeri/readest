import Image from 'next/image';
import { STORYBORED_LOGO_ASSETS } from '@/integrations/storybored/StoryBoredLogo';

export default function Offline() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-gray-100 text-center'>
      <div className='mb-4'>
        <Image
          src={STORYBORED_LOGO_ASSETS.appIcon}
          alt='StoryBored app icon'
          width={100}
          height={100}
          className='rounded-lg'
        />
      </div>

      <h1 className='text-2xl font-bold text-gray-800'>StoryBored</h1>

      <p className='mt-2 text-gray-600'>
        It seems you&apos;re offline. Please check your internet connection and try again.
      </p>
    </div>
  );
}
