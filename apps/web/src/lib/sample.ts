/** A made-up pass used on the landing and sign-in pages. */
export const samplePass = {
  name: 'Farah Naeem',
  company: 'Nova Logistics',
  hostName: 'Sana Malik',
  expectedFrom: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
  expectedTo: new Date(new Date().setHours(12, 30, 0, 0)).toISOString(),
  status: 'SCHEDULED' as const,
  passToken: 'v1.sample-pass-preview.0000000000.signature000000',
  passCode: '482913',
};
