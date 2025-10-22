'use strict';

// https://experienceleague.adobe.com/fr/docs/campaign-standard/using/developing/datamodel/datamodel-delivery

const ADOBE_DELIVERY_STATES = {
  EXPORTING: '0',
  TARGETING_PENDING: '11',
  COUNTING_IN_PROGRESS: '12',
  ARBITRATION_IN_PROGRESS: '13',
  TARGET_READY: '15',
  PERSONALIZATION_PENDING: '21',
  MESSAGE_FINALIZED: '25',
  PERSONALIZATION_FAILED: '37',
  READY_TO_BE_DELIVERED: '45',
};

const ADOBE_DELIVERY_STATE_VALUES = Object.values(ADOBE_DELIVERY_STATES);

module.exports = {
  ADOBE_DELIVERY_STATES,
  ADOBE_DELIVERY_STATE_VALUES,
};
