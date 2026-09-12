import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

type Props = {
  params: {
    size: string;
  };
};

function getIconSize(sizeParam: string): number {
  const sizeMap: { [key: string]: number } = {
    '192': 192,
    '512': 512,
    '192-maskable': 192,
  };
  return sizeMap[sizeParam] || 192;
}

function getFontSizeMultiplier(sizeParam: string): number {
  // Maskable icons need smaller font to fit within safe circular area
  return sizeParam.includes('maskable') ? 0.42 : 0.6;
}

export async function GET(_: Request, { params }: Props) {
  const size = getIconSize(params.size);
  const fontSizeMultiplier = getFontSizeMultiplier(params.size);

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: size * fontSizeMultiplier,
          background: '#191919',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e9e9e7',
          fontWeight: 'bold',
        }}
      >
        P
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}
