import Image from 'next/image';

export function Brand() {
  return <span className="brand"><Image
    className="brand-logo"
    src="/images/islandhost-logo.jpeg"
    alt="Island Host Concierge. Service is our thing."
    width={1599}
    height={1066}
    unoptimized
    priority
  /></span>;
}
