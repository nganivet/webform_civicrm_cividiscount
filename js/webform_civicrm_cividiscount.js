(function ($) {
  Drupal.behaviors.wcd = {
    attach: function (context, settings) {
      var host = window.location.origin;

      // Set css for Registration Fees
      $("[id$='participant-fee-amount']").css({"pointer-events": "none", "width": "65px", "background": "#e4dddd", "opacity": "0.5", "border": "1px solid #999" });

      // Make the fieldset expanded If the Event is Set there
      $(".webform-client-form [id$='participant-event-id']").each(function () {
        var eventArr = $(this).val().split('-');
        var eventId = eventArr[0];
        if (eventId > 0) {
          var current = $(this);
          current.closest('fieldset').removeClass('collapsed');
          current.closest('div.fieldset-wrapper').css({'display': 'block'});
        }
      });

      //1. Ajax request to Get the Discount code from Civicrm using API Call
      var delay           = 1000;
      $(".discount-code-value input[type='text']").keyup(function () {
        var discount_code = $(".discount-code-value input[type='text']").val();
        setTimeout(function () {
          // Discount code present then Validate it
          if (discount_code.length > 0 && $(".discount-code-value input[type='text']").val() == discount_code) {
            // Call to CiviCRM Discount API
            $.ajax({
              type: 'POST',
              async: false,
              url: host + "/validate/discount/" + discount_code,
              success: function (data) {
                if (data.status == 'fail' && data.messages.length) {
                  alert(data.messages);
                  // Set the Discount field empty In case of any error found in validation
                  $(".discount-code-value input[type='text']").val(" ");
                  return;
                }
              }
            });
          } else {
            // NO Discount code present then disable all 'Apply discount' checkboxes
            var is_checked = jQuery("div[id*='apply-discount'] input[type='checkbox']").is(":checked");
            if(is_checked == true) {
              $("div[id*='apply-discount'] input[type='checkbox']").each(function() {
                $(this).trigger('click');
                this.checked = false;
              });
            }
          }
        }, delay);
      });

      //2. Ajax Request to Get the Event/Class Fees as per Class selected.
      var actual_val = '';
      $(".webform-component-select [id$='participant-event-id']").unbind("change").change(function () {
        var eventId = 0;
        eventSlug = $(this).val();
        if (eventSlug !== null) {
          eventArr = eventSlug.split('-');
          eventId = eventArr[0];
        }
        var current = $(this);
        //Reset the Apply Discount on every selection of Classes.
        current.parent().siblings("div[class*='participant-apply-discount']").find("input[type='checkbox']").val(0);
        current.parent().siblings("div[class*='participant-apply-discount']").find("input[type='checkbox']").attr('checked', false);

        if (eventId) {
          $.ajax({
            url: host + "/get/event_fees/" + eventId,
            success: function (data) {
              if (data.status == 'success') {
                actual_val = data.values;
                // Set the Discounted/Actual Fees in the Fees Field
                var actual_val_formatted = Math.floor(actual_val).toFixed(2);
                current.parent().siblings(".webform-container-inline").find("input[type='text']").val(actual_val_formatted);
              }
            }
          });
        } else {
          // Class drop-down is reset, clear fee field
          current.parent().siblings(".webform-container-inline").find("input[type='text']").val(0);
        }
      });

      // Hide the label for all the 'Apply Discount ?' field
      $("div[id*='apply-discount'] label").css({"display" : "none"});

      // Disabled all checkbox if Discount code option is disabled
      // Onload of discount option,disabled the checkboxes of Apply Discount
      var is_discount = $("[id$='do-you-have-a-discount'] input[type='radio']:checked").val();
      if(is_discount == 2) {
        $("div[id*='apply-discount'] input[type='checkbox']").css({"pointer-events": "none", "background": "#e4dddd", "opacity": "0.5"});
        $("div[id*='apply-discount'] input[type='checkbox']").each(function() {
          this.checked = false;
        });
      }
      // Handled the behaviour of Discount code on/off radio buttons
      $("[id$='do-you-have-a-discount'] input[type='radio']").unbind("click").click(function() {
        var is_discount = $(this).val();
        var is_checked = jQuery("div[id*='apply-discount'] input[type='checkbox']").is(":checked");

        // Disabled the Discount code : No if it's already in use ( i.e by checking the "Apply checkbox" options)
        if(is_discount == 2) {
          if(is_checked == true) {
            $(this).prop('checked', false);
            alert("Discount code is already in use");
            $("[id$='do-you-have-a-discount'] input[type='radio'][value='1']").prop('checked', true);
            return;
          } else {
            $(this).prop('checked', true);
          }
          $("div[id*='apply-discount'] input[type='checkbox']").css({"pointer-events": "none", "background": "#e4dddd", "opacity": "0.5"});
          $("div[id*='apply-discount'] input[type='checkbox']").each(function() {
            this.checked = false;
          });
        } else {
          $("div[id*='apply-discount'] input[type='checkbox']").css({"pointer-events": "auto", "background": "#ffffff", "opacity": "1"});
        }
      });

      // Set the Fees on click of Checkbox
      $("div[id*='apply-discount'] input[type='checkbox']").unbind("click").click(function() {
        var current     = $(this);
        var event_fees; var discount_amount; var discount_percentage; var discount_limit; var discount_usable_limit;
        var total_count = $("div[id*='apply-discount'] input[type='checkbox']:checked").size();
        var discount_code = $(".discount-code-value input[type='text']").val();

        var event_ids   = current.parents("div[class*='participant-apply-discount']").siblings("div[class*='participant-event-id']").find("select").val();
        var eventArr    = event_ids.split('-');
        var eventId     = eventArr[0];
        if (eventId) {
          $.ajax({
            url: host + "/get/event_fees/" + eventId,
            async: false,
            success: function (data) {
              if (data.status == 'success') {
                event_fees = data.values;
              }
            }
          });
        }
        if(discount_code.length > 0) {
          $.ajax({
            method: "POST",
            async: false,
            url: host + "/validate/discount/" + discount_code,
            success: function (data) {
              if (data.status == 'success') {
                discount_limit        = data.discount.limit;
                discount_usable_limit = data.discount.usable_limit;
                discount_amount       = data.discount.amount;
                discount_percentage   = data.discount.percentage;
              }
            }
          });
        } else {
          alert('Discount code in empty');
          this.checked = false;
          return;
        }

        // Check for the number of times Discount code used
        // Discount Limit = 0 : Unlimited
        if(discount_limit != 0 && total_count > discount_usable_limit) {
          alert("The discount code limit usage has been reached");
          this.checked = false;
          return;
        }

        if ($(this).is(':checked')) {
          // Get the calculated value of discount
          var discounted_val = get_discounted_value(event_fees, discount_amount, discount_percentage);
        } else {
          var discounted_val = event_fees;
        }

        // Set the calculated discounted/Actual Fees in CiviCRM Event Fees Field
        if(typeof discounted_val  !== "undefined") {
          var discounted_val_formatted = Number.parseFloat(discounted_val).toFixed(2);
        } else {
          var discounted_val_formatted = 0;
        }
        current.parents("div[class*='participant-apply-discount']").siblings("div[class*='participant-fee-amount']").find("input[type='text']").val(discounted_val_formatted);
      });

      // Function to Calculate the actual discounted values
      function get_discounted_value (event_fees, discount_amount, discount_percentage) {
        var discounted_values = event_fees;
        if(typeof discount_amount !== "undefined" && typeof discount_percentage !== "undefined") {
          discounted_values = event_fees - (event_fees * discount_percentage / 100) - (discount_amount);
        }
        return discounted_values;
      }

      // Function to get the Event Id from URL
      function getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
          results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
      }

    } // end of attached
  }
}(jQuery));
