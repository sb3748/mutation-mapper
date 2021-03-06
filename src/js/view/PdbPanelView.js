/*
 * Copyright (c) 2015 Memorial Sloan-Kettering Cancer Center.
 *
 * This library is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY, WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS
 * FOR A PARTICULAR PURPOSE. The software and documentation provided hereunder
 * is on an "as is" basis, and Memorial Sloan-Kettering Cancer Center has no
 * obligations to provide maintenance, support, updates, enhancements or
 * modifications. In no event shall Memorial Sloan-Kettering Cancer Center be
 * liable to any party for direct, indirect, special, incidental or
 * consequential damages, including lost profits, arising out of the use of this
 * software and its documentation, even if Memorial Sloan-Kettering Cancer
 * Center has been advised of the possibility of such damage.
 */

/*
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var MutationPdbPanel = require("../component/MutationPdbPanel");
var PdbTableView = require("../view/PdbTableView");
var BackboneTemplateCache = require("../util/BackboneTemplateCache");

var loaderImage = require("../../images/ajax-loader.gif");

var Backbone = require("backbone");
var $ = require("jquery");
var jQuery = $;
require("jquery-flesler-scrollto");

/**
 * PDB Panel View.
 *
 * This view is designed to function in parallel with the 3D visualizer.
 *
 * options: {el: [target container],
 *           model: {geneSymbol: hugo gene symbol,
 *                   pdbColl: collection of PdbModel instances,
 *                   pdbProxy: pdb data proxy,
 *                   pdbPanelOpts: MutationPdbPanel options,
 *                   pdbTableOpts: MutationPdbTable options},
 *           diagram: [optional] reference to the MutationDiagram instance
 *          }
 *
 * @author Selcuk Onur Sumer
 */
var PdbPanelView = Backbone.View.extend({
	initialize : function (options) {
		var defaultOpts = {
			config: {
				loaderImage: loaderImage,
				autoExpand: true
			}
		};

		this.options = jQuery.extend(true, {}, defaultOpts, options);
		this.collapseTimer = null;
		this.expandTimer = null;
	},
	render: function()
	{
		var self = this;

		// compile the template using underscore
		var templateFn = BackboneTemplateCache.getTemplateFn("pdb_panel_view_template");
		var template = templateFn({});

		// load the compiled HTML into the Backbone "el"
		self.$el.html(template);

		// init pdb panel
		self.pdbPanel = self._initPdbPanel();

		// format after rendering
		self.format();
	},
	format: function()
	{
		var self = this;

		// hide view initially
		self.$el.hide();

		// format panel controls
		var expandButton = self.$el.find(".expand-collapse-pdb-panel");
		var pdbTableInit = self.$el.find(".init-pdb-table");
		var pdbTableControls = self.$el.find(".pdb-table-controls");
		var triangleDown = self.$el.find(".triangle-down");
		var triangle = self.$el.find(".triangle");

		// format the expand button if there are more chains to show
		if (self.pdbPanel.hasMoreChains())
		{
			expandButton.button({
				icons: {primary: "ui-icon-triangle-2-n-s"},
				text: false});
			expandButton.css({width: "300px", height: "12px"});

			expandButton.click(function() {
				self.pdbPanel.toggleHeight();
			});
		}

		// initially hide controls
		expandButton.hide();
		pdbTableControls.hide();

		triangleDown.hide();

		// make triangles clickable
		triangle.click(function(event) {
			// same as clicking on the link
			pdbTableInit.click();
		});

		if (self.options.config.autoExpand)
		{
			self.$el.find(".mutation-pdb-main-container").mouseenter(function(evt) {
				self.autoExpand();
			});

			self.$el.find(".mutation-pdb-main-container").mouseleave(function(evt) {
				self.autoCollapse();
			});
		}
	},
	hideView: function()
	{
		var self = this;
		self.$el.slideUp();
	},
	showView: function()
	{
		var self = this;
		self.$el.slideDown();
	},
	initPdbTableView: function(pdbColl, callback)
	{
		var self = this;

		var tableOpts = {
			el: self.$el.find(".mutation-pdb-table-view"),
			config: {loaderImage: self.options.config.loaderImage},
			model: {geneSymbol: self.model.geneSymbol,
				pdbColl: pdbColl,
				pdbProxy: self.model.pdbProxy}
		};

		tableOpts = jQuery.extend(true, {}, self.model.pdbTableOpts, tableOpts);
		var pdbTableView = new PdbTableView(tableOpts);
		self.pdbTableView = pdbTableView;

		pdbTableView.render(callback);

		return pdbTableView;
	},
	/**
	 * Adds a callback function for the PDB table init button.
	 *
	 * @param callback  function to be invoked on click
	 */
	addInitCallback: function(callback) {
		var self = this;
		var pdbTableInit = self.$el.find(".init-pdb-table");

		// add listener to pdb table init button
		pdbTableInit.click(function(event) {
			event.preventDefault();
			callback(event);
		});
	},
	toggleTableControls: function()
	{
		var self = this;

		// just toggle triangle orientation
		self.$el.find(".triangle").toggle();
	},
	/**
	 * Selects the default pdb and chain for the 3D visualizer.
	 * Default chain is one of the chains in the first row.
	 */
	selectDefaultChain: function()
	{
		var self = this;
		var panel = self.pdbPanel;
		var gChain = panel.getDefaultChainGroup();

		// clear previous timers
		self.clearTimers();

		// restore chain positions
		panel.restoreChainPositions(function() {
			// highlight the default chain
			panel.highlight(gChain);
		});
	},
	/**
	 * Selects the given pdb and chain for the 3D visualizer.
	 *
	 * @param pdbId     pdb to be selected
	 * @param chainId   chain to be selected
	 */
	selectChain: function(pdbId, chainId)
	{
		var self = this;
		var panel = self.pdbPanel;

		// clear previous timers
		self.clearTimers();

		// restore to original positions & highlight the chain
		panel.restoreChainPositions(function() {
			// expand the panel up to the level of the given chain
			panel.expandToChainLevel(pdbId, chainId);

			// get the chain group
			var gChain = panel.getChainGroup(pdbId, chainId);

			// highlight the chain group
			if (gChain)
			{
				panel.highlight(gChain);
			}
		});
	},
	getSelectedChain: function()
	{
		var self = this;
		var panel = self.pdbPanel;

		return panel.getHighlighted();
	},
	/**
	 * Initializes the auto collapse process.
	 *
	 * @delay time to minimization
	 */
	autoCollapse: function(delay)
	{
		if (delay == null)
		{
			delay = 2000;
		}

		var self = this;
		var expandButton = self.$el.find(".expand-collapse-pdb-panel");
		var pdbTableControls = self.$el.find(".pdb-table-controls");
		var pdbTableWrapper = self.$el.find(".pdb-table-wrapper");

		// clear previous timers
		self.clearTimers();

		// set new timer
		self.collapseTimer = setTimeout(function() {
			self.pdbPanel.minimizeToHighlighted();
			expandButton.slideUp();
			pdbTableControls.slideUp();
			pdbTableWrapper.slideUp();
		}, delay);
	},
	/**
	 * Initializes the auto expand process.
	 *
	 * @delay time to minimization
	 */
	autoExpand: function(delay)
	{
		if (delay == null)
		{
			delay = 400;
		}

		var self = this;
		var expandButton = self.$el.find(".expand-collapse-pdb-panel");
		var pdbTableControls = self.$el.find(".pdb-table-controls");
		var pdbTableWrapper = self.$el.find(".pdb-table-wrapper");

		// clear previous timers
		self.clearTimers();

		// set new timer
		self.expandTimer = setTimeout(function() {
			self.pdbPanel.restoreToFull();

			if (self.pdbPanel.hasMoreChains())
			{
				expandButton.slideDown();
			}

			pdbTableControls.slideDown();
			pdbTableWrapper.slideDown();

			if (self.pdbTableView != null)
			{
				self.pdbTableView.refreshView();
			}
		}, delay);
	},
	/**
	 * Limits the size of the panel by the given max height value,
	 * and adds a scroll bar for the y-axis. If max height is not
	 * a valid value, then disables the scroll bar.
	 *
	 * @param maxHeight desired max height value
	 */
	toggleScrollBar: function(maxHeight)
	{
		var self = this;
		var container = self.$el.find(".mutation-pdb-panel-container");

		if (maxHeight > 0)
		{
			container.css("max-height", maxHeight);
			container.css("overflow", "");
			container.css("overflow-y", "scroll");
		}
		else
		{
			container.css("max-height", "");
			container.css("overflow-y", "");
			container.css("overflow", "hidden");
		}
	},
	/**
	 * Moves the scroll bar to the selected chain's position.
	 */
	scrollToSelected: function()
	{
		var self = this;
		var container = self.$el.find(".mutation-pdb-panel-container");

		// TODO make scroll parameters customizable?
		container.scrollTo($(".pdb-selection-rectangle-group"),
		                   {axis: 'y', duration: 800, offset: -150});
	},
	clearTimers: function()
	{
		var self = this;

		if (self.collapseTimer != null)
		{
			clearTimeout(self.collapseTimer);
		}

		if (self.expandTimer != null)
		{
			clearTimeout(self.expandTimer);
		}
	},
	/**
	 * Initializes the PDB chain panel.
	 *
	 * @return {MutationPdbPanel}   panel instance
	 */
	_initPdbPanel: function()
	{
		var self = this;

		var pdbColl = self.model.pdbColl;
		var pdbProxy = self.model.pdbProxy;
		var mutationDiagram = self.options.diagram;

		var options = {el: self.$el.find(".mutation-pdb-panel-container"),
				maxHeight: 200};
		var xScale = null;

		// if mutation diagram is enabled,
		// get certain values from mutation diagram for consistent rendering!
		if (mutationDiagram != null)
		{
			xScale = mutationDiagram.xScale;

			// set margin same as the diagram margin for correct alignment with x-axis

			options.marginLeft = mutationDiagram.options.marginLeft;
			options.marginRight = mutationDiagram.options.marginRight;
		}

		// init panel
		options = jQuery.extend(true, {}, self.model.pdbPanelOpts, options);
		var panel = new MutationPdbPanel(options, pdbColl, pdbProxy, xScale);
		panel.init();

		return panel;
	}
});

module.exports = PdbPanelView;