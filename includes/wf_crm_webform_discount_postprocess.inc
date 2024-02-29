<?php

/**
 * @file
 * Front-end form validation and post-processing.
 */


class wf_crm_webform_discount_postprocess {
  // Cache an instance of this object
  // @see self::singleton()
  private $discount_code;
  private $discount_contact;

  static $singleton;

  function __construct($node) {
    civicrm_initialize();
    $this->node = $node;
    $this->settings = $node->webform_civicrm;
    $this->data = $this->settings['data'];
  }

  /**
   * This is first called during form validation. We create an instance of this object and stash it in a static variable.
   * It is destroyed and rebuilt between each page submission, but after (successful) validation of the final page,
   * this cache allows the object instance to persist throughout (final) validate, preSave and postSave operations.
   * @param stdClass $node
   * @return wf_crm_webform_postprocess
   */
  public static function singleton($node) {
    if (!self::$singleton) {
      self::$singleton = new wf_crm_webform_discount_postprocess($node);
    }
    return self::$singleton;
  }

   /**
   * Process webform submission after it is has been saved. Called by the following hooks:
   * @see webform_civicrm_webform_submission_insert
   * @see webform_civicrm_webform_submission_update
   * @param stdClass $submission
   */
  public function postSave($submission, $node) {
    $this->submission = $submission;

    $discounted_contacts_ids = $this->getDiscountedContactIds($submission, $node);
    // While saving a draft, just skip to postSave and write the record
    if (!empty($this->submission->is_draft)) {
      return;
    }
    //@todo : For CiviDiscount: we are using plain webform field instead of creating from CiviCRM
    // So currently key is taken as hardcoded as 'discount_code'
    $this->discount_code = $this->getFormValueByKey('discount_code', $submission, $node);
    if (!empty($this->discount_code)) {
      // API call for the Discount Track API
      $this->processDiscount();
    }
  }
  // Helper function to get Contact Id who avails the discount
  public function getDiscountedContactIds($submission, $node) {
    $contact_arr = array();
    for ($x = 2; $x <= 6; $x++) {
      for($y = 1; $y <=5; $y++) {
        $contact_ids  = "civicrm_" . $x . "_contact_1_contact_existing";
        $discount_ids = "civicrm_" . $x . "_participant_" . $y . "_participant_apply_discount";
        $event_ids    = "civicrm_" . $x . "_participant_" . $y . "_participant_event_id";

        // Get the value by Key from Webform submittions object
        $cid = $this->getFormValueByKey($contact_ids, $submission, $node);
        $did = $this->getFormValueByKey($discount_ids, $submission, $node);
        $eid = $this->getFormValueByKey($event_ids, $submission, $node);
        // Event Id is in format : xxx-xx
        $eid =  explode("-", $eid);
        $eid = $eid[0];
        if (isset($cid) && is_numeric($cid)) {
          $contact_arr[$cid][$eid] = $did;
        }
      }
    }

    foreach( $contact_arr  as $k => $val ) {
      $contact_filter[$k] = array_filter($contact_arr[$k]);
    }
    $contact_filter_final = array_filter($contact_filter);
    $this->discount_contact =  $contact_filter_final;
  }

  // Helper function to get the Value from Key of Webform
  public function getFormValueByKey($key, $submission, $node) {
    $compMap = array();
    foreach ($node->webform['components'] as $c) {
      $compMap[$c['form_key']] = $c['cid'];
    }
    $value = '';

    if (array_key_exists($compMap[$key], $submission->data)) {
      $value = $submission->data[$compMap[$key]][0];
    }
    return $value;
  }

  /**
   * Save/Update Discount data
   */
  public function processDiscount() {
    global $participant_arr ;
    $discounted_contacts =  $this->discount_contact;
    // Get the Discount Id by Code
    $discount_details = civicrm_api3('DiscountCode', 'get', array(
      'sequential' => 1,
      'is_active' => 1,
      'code' => $this->discount_code,
    ));

    if(empty($discount_details['id'])) {
      return;
    }

    //Call of Discount Track API
    if(isset($participant_arr) && !empty($participant_arr)) {
      // Get only the discounted contact array
      $participant_arr_filter = array_intersect_key($participant_arr, $discounted_contacts);

      // Get only those participant details for which discount get applied and unset the others
      foreach ($participant_arr_filter as $k => $val) {
        foreach ($val as $ek => $ev) {
          if(!array_key_exists($ek, $discounted_contacts[$k])) {
              unset($participant_arr_filter[$k][$ek]);
          }
        }
      }
      // Call Discount track to actually reflect the values on Discount screen in Civi
      foreach ($participant_arr_filter as $cid => $values) {
        foreach ($values as $v) {
          $result = civicrm_api3('DiscountTrack', 'create', array(
            'entity_table' => "civicrm_participant",
            'entity_id' => $v['pid'],
            'item_id' => $discount_details['id'],
            'contact_id' => $cid,
          ));
        }
      }
    }
  }
}
