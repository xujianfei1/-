'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-surface group-[.toaster]:text-text group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-text-muted',
          actionButton: 'group-[.toast]:bg-accent group-[.toast]:text-white',
          cancelButton: 'group-[.toast]:bg-surface-hover group-[.toast]:text-text-muted',
        },
      }}
      position="top-right"
      richColors
      {...props}
    />
  );
};

export { Toaster };
