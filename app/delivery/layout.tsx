import React from 'react';

export const metadata = {
  title: 'SwiftDrop — KC Local Delivery',
  description: 'Hyper-local delivery from your favorite Kansas City restaurants',
};

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#FAFAFA', minHeight: '100vh' }}>
      {children}
    </div>
  );
}
