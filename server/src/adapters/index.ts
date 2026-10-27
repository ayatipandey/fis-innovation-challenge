// Partner adapters. In a live network, a partner brand reports back when a
// member completes a purchase with a Perkly reward (through an affiliate
// postback, a point-of-sale integration or a code-redemption feed). Only a mock
// adapter exists in this prototype: it never contacts a brand.

import type { Channel, Offer } from '../../../shared/types';

export interface PartnerReport {
  confirmed: boolean;
  reference: string | null;
  simulated: boolean;
}

export interface PartnerAdapter {
  reportUse(offer: Offer, channel: Channel): PartnerReport;
}

export const mockPartner: PartnerAdapter = {
  reportUse: () => ({ confirmed: true, reference: `demo_${Date.now().toString(36)}`, simulated: true }),
};
