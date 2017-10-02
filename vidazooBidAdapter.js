import * as utils from 'src/utils';
import {registerBidder} from 'src/adapters/bidderFactory';

const BIDDER_CODE = 'vidazoo';
const BASE_URL = 'https://openrtb.cliipa.com';
// const BASE_URL = 'http://localhost:8067';
const INTERNAL_SYNC_TYPE = {
  IFRAME: 'iframe',
  IMAGE: 'img'
};
const EXTERNAL_SYNC_TYPE = {
  IFRAME: 'iframe',
  IMAGE: 'image'
};

function isBidRequestValid(bid) {
  const params = bid.params || {};
  return !!(params.cId && params.userId && params.dId);
}

function bidToRequests(bid, topWindowUrl) {
  const {params, bidId} = bid;
  const {bidFloor, cId, userId, dId} = params;

  const requests = [];
  for (let i = 0, len = bid.sizes.length; i < len; i++) {
    const size = bid.sizes[i];
    const payload = {
      width: size[0],
      height: size[1],
      url: topWindowUrl,
      cache: false,
      cb: Date.now(),
      bidFloor: bidFloor,
      bidId: bidId
    };

    requests.push({
      method: 'GET',
      url: `${BASE_URL}/api/prebid/${cId}/${userId}/${dId}`,
      data: payload
    });
  }
  return requests;
}

function buildRequests(validBidRequests) {
  const topWindowUrl = utils.getTopWindowUrl();

  const requests = [];
  for (let i = 0, len = validBidRequests.length; i < len; i++) {
    Array.prototype.push.apply(requests, bidToRequests(validBidRequests[i], topWindowUrl));
  }

  return requests;
}

function interpretResponse(serverResponse, request) {
  if (!serverResponse || !serverResponse.data || serverResponse.adm) {
    return [];
  }
  const {bidId, width, height} = request.data;
  const {param3, param5, price} = serverResponse.data;
  try {
    return [{
      requestId: bidId,
      bidderCode: BIDDER_CODE,
      cpm: price,
      width: width,
      height: height,
      creativeId: param3,
      dealId: param5,
      // currency: CURRENCY,
      // netRevenue: true,
      // ttl: TIME_TO_LIVE,
      // referrer: REFERER,
      ad: serverResponse.adm
    }];
  } catch (e) {
    return [];
  }
}

function getUserSyncs(syncOptions, responses) {
  const {iframeEnabled, pixelEnabled} = syncOptions;
  const syncs = [];
  for (let i = 0, leni = responses.length; i < leni; i++) {
    const response = responses[i];
    if (!response.data || !response.data.cookies || !response.data.cookies.length) {
      continue;
    }
    for (let j = 0, lenj = response.data.cookies.length; j < lenj; j++) {
      const cookie = response.data.cookies[j];
      switch (cookie.type) {
        case INTERNAL_SYNC_TYPE.IFRAME:
          iframeEnabled && (syncs.push({
            type: EXTERNAL_SYNC_TYPE.IFRAME,
            url: cookie.src
          }));
          break;
        case INTERNAL_SYNC_TYPE.IMAGE:
          pixelEnabled && (syncs.push({
            type: EXTERNAL_SYNC_TYPE.IMAGE,
            url: cookie.src
          }));
          break;
      }
    }
  }
  return syncs;
}

export const spec = {
  code: BIDDER_CODE,
  // aliases: ['ex'], // short code
  isBidRequestValid: isBidRequestValid,
  buildRequests: buildRequests,
  interpretResponse: interpretResponse,
  getUserSyncs: getUserSyncs
};

registerBidder(spec);
