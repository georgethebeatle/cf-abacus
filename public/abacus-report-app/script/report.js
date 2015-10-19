"use strict";

const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const day = 3;
const month = 4;

$( document ).ready(function() {
  $("#reportTable").treetable({
    expandable: true,
    initialState: "expanded"
  });
});

function orgChargeData(orgGuid, charge) {
  return "<tr data-tt-id=\"0\">"
    + "<td>Organization: " + orgGuid + "</td>"
    + "<td>" + charge.toFixed(10) + " €</td>"
    + "</tr>"
}

function spaceChargeData(space) {
  return "<tr data-tt-id=\"" + space.space_id + "\" data-tt-parent-id=\"0\">"
    + "<td>Space: " + space.space_id + "</td>"
    + "<td>" + space.windows[month][0].charge.toFixed(10) + " €</td>"
    + "</tr>"
}

function reloadReport() {
  reloadTreetable();
  renderChart();
}

function reloadTreetable() {
  var orgGuid = $("#org").val();
  var $table = $("#reportTable");

  var node = $table.treetable("node", 0);
  if (node)
    $table.treetable("removeNode", 0);

  $.ajax({
    url: "http://localhost:9088/v1/metering/organizations/" + orgGuid + "/aggregated/usage",
    success: function(result) {
      $table.treetable("loadBranch", null, orgChargeData(orgGuid, result.windows[month][0].charge));
      const spaces = result.spaces;
      _.each(spaces, function(space) {
        var node = $table.treetable("node", 0);
        $table.treetable("loadBranch", node, spaceChargeData(space));
      });
    },
    error: function(jqXHR) {
      $("#error").html('Cannot fetch usage data: ' + jqXHR.responseText);
    }
  });
}

function renderChart() {
  var orgGuid = $("#org").val();

  const today = new Date();
  const thisYear = today.getFullYear();
  const thisMonth = today.getMonth();

  var data = [];
  var chart = new CanvasJS.Chart("chartContainer", {
    title:{
      text: 'App Usage for ' + monthNames[today.getMonth()] + ' ' + today.getFullYear()
    },
    data: [
      {
       type: "column",
       dataPoints: data
      }
    ]
  });

  for (var date = 1; date <= today.getDate(); date++) {
    var endOfDay = new Date(thisYear, thisMonth, date, 23, 59, 59).getTime();
    data.push({ label: date + '.' + thisMonth, y: 0 });
    chart.render();
    plotDailyUsage(date, orgGuid, endOfDay, chart)
  }
}

function plotDailyUsage(date, orgGuid, endOfDay, chart) {
  $.ajax({
    url: "http://localhost:9088/v1/metering/organizations/" + orgGuid + "/aggregated/usage/" + endOfDay,
    success: function(result) {
      var charge = result.resources.length > 0 ? result.windows[day][0].charge : 0;

      chart.options.data[0].dataPoints[date-1].y = charge;
      chart.render();
    },
    error: function(jqXHR) {
      $("#error").html('Cannot fetch usage data: ' + jqXHR.responseText);
    }
  });
}
