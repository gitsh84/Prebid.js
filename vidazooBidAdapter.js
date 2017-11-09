import * as utils from 'src/utils';
import {registerBidder} from 'src/adapters/bidderFactory';

const BIDDER_CODE = 'vidazoo';
const CURRENCY = 'USD';
const TTL_SECONDS = 60 * 5;
const URL = '//display-ad-server.vidazoo.com';
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
  return !!(params.cId && params.uId && params.dId);
}

function buildRequest(bid, topWindowUrl, size) {
  const {params, bidId} = bid;
  const {bidFloor, cId, uId, dId} = params;

  return {
    method: 'GET',
    url: `${URL}/prebid/${uId}/${dId}`,
    data: {
      width: size[0],
      height: size[1],
      url: topWindowUrl,
      cb: Date.now(),
      bidFloor: bidFloor,
      bidId: bidId,
      connectionId: cId
    }
  }
}

function buildRequests(validBidRequests) {
  const topWindowUrl = utils.getTopWindowUrl();
  const requests = [];
  validBidRequests.forEach(validBidRequest => {
    validBidRequest.sizes.forEach(size => {
      const request = buildRequest(validBidRequest, topWindowUrl, size);
      requests.push(request);
    });
  });
  return requests;
}

function interpretResponse(serverResponse, request) {
  if (!serverResponse) {
    return [];
  }
  const {creativeId, dealId, ad, price, exp} = serverResponse;
  if (!ad || !price) {
    return [];
  }

  const {bidId, width, height} = request.data;
  try {
    return [{
      requestId: bidId,
      bidderCode: BIDDER_CODE,
      cpm: price,
      width: width,
      height: height,
      creativeId: creativeId,
      dealId: dealId,
      currency: CURRENCY,
      netRevenue: true,
      ttl: exp || TTL_SECONDS,
      // referrer: REFERER,
      ad: ad
    }];
  } catch (e) {
    return [];
  }
}

function getUserSyncs(syncOptions, responses) {
  const {iframeEnabled, pixelEnabled} = syncOptions;
  const syncs = [];
  responses.forEach(response => {
    const cookies = response ? response.cookies || [] : [];
    cookies.forEach(cookie => {
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
    });
  });
  return syncs;
}

export const spec = {
  code: BIDDER_CODE,
  isBidRequestValid,
  buildRequests,
  interpretResponse,
  getUserSyncs
};

registerBidder(spec);
