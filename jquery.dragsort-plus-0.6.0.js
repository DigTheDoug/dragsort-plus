// jQuery List DragSort-Plus v0.6.2
// https://github.com/DigTheDoug/dragsort

// Based off jQuery List DragSort
// jQuery List DragSort v0.5.1
// Website: http://dragsort.codeplex.com/
// License: http://dragsort.codeplex.com/license

(function($) {

	$.fn.dragsort = function(options) {
		if (options == "destroy") {
			$(this.selector).trigger("dragsort-uninit");
			return;
		}

		var opts = $.extend({}, $.fn.dragsort.defaults, options);
		var lists = [];
		var list = null, lastPos = null;

        var helpers = [];

		this.each(function(i, cont) {

			//if list container is table, the browser automatically wraps rows in tbody if not specified so change list container to tbody so that children returns rows as user expected
			if ($(cont).is("table") && $(cont).children().size() == 1 && $(cont).children().is("tbody"))
				cont = $(cont).children().get(0);

			var newList = {
				draggedItem: null,
				placeHolderItem: null,
				pos: null,
				offset: null,
				offsetLimit: null,
				scroll: null,
				container: cont,

				init: function() {
					//set options to default values if not set
					var tagName = $(this.container).children().size() == 0 ? "li" : $(this.container).children(":first").get(0).tagName.toLowerCase();
					if (opts.itemSelector == "")
						opts.itemSelector = tagName;
					if (opts.dragSelector == "")
						opts.dragSelector = tagName;
					if (opts.placeHolderTemplate == "")
						opts.placeHolderTemplate = "<" + tagName + ">&nbsp;</" + tagName + ">";

					//listidx allows reference back to correct list variable instance
					$(this.container).attr("data-listidx", i).mousedown(this.grabItem).bind("dragsort-uninit", this.uninit);
					this.styleDragHandlers(true);
				},

				uninit: function() {
					var list = lists[$(this).attr("data-listidx")];
					$(list.container).unbind("mousedown", list.grabItem).unbind("dragsort-uninit");
					list.styleDragHandlers(false);
				},

				getItems: function() {
					return $(this.container).children(opts.itemSelector);
				},

				styleDragHandlers: function(cursor) {
					this.getItems().map(function() { return $(this).is(opts.dragSelector) ? this : $(this).find(opts.dragSelector).get(); }).css("cursor", cursor ? "pointer" : "");
				},

				grabItem: function(e) {
					//if not left click or if clicked on excluded element (e.g. text box) or not a moveable list item return
					if (e.which != 1 || $(e.target).is(opts.dragSelectorExclude) || $(e.target).closest(opts.dragSelectorExclude).size() > 0 || $(e.target).closest(opts.itemSelector).size() == 0)
						return;

					//prevents selection, stops issue on Fx where dragging hyperlink doesn't work and on IE where it triggers mousemove even though mouse hasn't moved,
					//does also stop being able to click text boxes hence dragging on text boxes by default is disabled in dragSelectorExclude
					e.preventDefault();

					//change cursor to move while dragging
					var dragHandle = e.target;
					while (!$(dragHandle).is(opts.dragSelector)) {
						if (dragHandle == this) return;
						dragHandle = dragHandle.parentNode;
					}
					$(dragHandle).attr("data-cursor", $(dragHandle).css("cursor"));
					$(dragHandle).css("cursor", "move");

					//on mousedown wait for movement of mouse before triggering dragsort script (dragStart) to allow clicking of hyperlinks to work
					var list = lists[$(this).attr("data-listidx")];
					var item = this;
					var trigger = function() {
						list.dragStart.call(item, e);
						$(list.container).unbind("mousemove", trigger);
					};
					$(list.container).mousemove(trigger).mouseup(function() { $(list.container).unbind("mousemove", trigger); $(dragHandle).css("cursor", $(dragHandle).attr("data-cursor")); });
				},

				dragStart: function(e) {
					if (list != null && list.draggedItem != null)
						list.dropItem();

					list = lists[$(this).attr("data-listidx")];
					list.draggedItem = $(e.target).closest(opts.itemSelector);

					//record current position so on dragend we know if the dragged item changed position or not
					list.draggedItem.attr("data-origpos", $(this).attr("data-listidx") + "-" + list.getItems().index(list.draggedItem));

					//calculate mouse offset relative to draggedItem
					var mt = parseInt(list.draggedItem.css("marginTop"));
					var ml = parseInt(list.draggedItem.css("marginLeft"));
					list.offset = list.draggedItem.offset();
					list.offset.top = e.pageY - list.offset.top + (isNaN(mt) ? 0 : mt) - 1;
					list.offset.left = e.pageX - list.offset.left + (isNaN(ml) ? 0 : ml) - 1;

					//calculate box the dragged item can't be dragged outside of
					if (!opts.dragBetween) {
						var containerHeight = $(list.container).outerHeight() == 0 ? Math.max(1, Math.round(0.5 + list.getItems().size() * list.draggedItem.outerWidth() / $(list.container).outerWidth())) * list.draggedItem.outerHeight() : $(list.container).outerHeight();
						list.offsetLimit = $(list.container).offset();
						list.offsetLimit.right = list.offsetLimit.left + $(list.container).outerWidth() - list.draggedItem.outerWidth();
						list.offsetLimit.bottom = list.offsetLimit.top + containerHeight - list.draggedItem.outerHeight();
					}

					//create placeholder item
					var h = list.draggedItem.height();
					var w = list.draggedItem.width();
					if (opts.itemSelector == "tr") {
						list.draggedItem.children().each(function() { $(this).width($(this).width()); });
						list.placeHolderItem = list.draggedItem.clone().attr("data-placeholder", true);
						list.draggedItem.after(list.placeHolderItem);
						list.placeHolderItem.children().each(function() { $(this).css({ borderWidth:0, width: $(this).width() + 1, height: $(this).height() + 1 }).html("&nbsp;"); });
					} else {
						list.draggedItem.after(opts.placeHolderTemplate);
						list.placeHolderItem = list.draggedItem.next().css({ height: h, width: w }).attr("data-placeholder", true);
					}

					if (opts.itemSelector == "td") {
						var listTable = list.draggedItem.closest("table").get(0);
						$("<table id='" + listTable.id + "' style='border-width: 0px;' class='dragSortItem " + listTable.className + "'><tr></tr></table>").appendTo("body").children().append(list.draggedItem);
					}

					//style draggedItem while dragging
					var orig = list.draggedItem.attr("style");
					list.draggedItem.attr("data-origstyle", orig ? orig : "");
					list.draggedItem.css({ position: "absolute", opacity: 0.8, "z-index": 999, height: h, width: w });

					//auto-scroll setup
					list.scroll = { moveX: 0, moveY: 0, maxX: $(document).width() - $(window).width(), maxY: $(document).height() - $(window).height() };
					list.scroll.scrollY = window.setInterval(function() {
						if (opts.scrollContainer != window) {
							$(opts.scrollContainer).scrollTop($(opts.scrollContainer).scrollTop() + list.scroll.moveY);
							return;
						}
						var t = $(opts.scrollContainer).scrollTop();
						if (list.scroll.moveY > 0 && t < list.scroll.maxY || list.scroll.moveY < 0 && t > 0) {
							$(opts.scrollContainer).scrollTop(t + list.scroll.moveY);
							list.draggedItem.css("top", list.draggedItem.offset().top + list.scroll.moveY + 1);
						}
					}, 10);
					list.scroll.scrollX = window.setInterval(function() {
						if (opts.scrollContainer != window) {
							$(opts.scrollContainer).scrollLeft($(opts.scrollContainer).scrollLeft() + list.scroll.moveX);
							return;
						}
						var l = $(opts.scrollContainer).scrollLeft();
						if (list.scroll.moveX > 0 && l < list.scroll.maxX || list.scroll.moveX < 0 && l > 0) {
							$(opts.scrollContainer).scrollLeft(l + list.scroll.moveX);
							list.draggedItem.css("left", list.draggedItem.offset().left + list.scroll.moveX + 1);
						}
					}, 10);

                    var context = (opts.context == null) ? list.draggedItem : opts.context;
                    opts.dragStart.apply(context);

					//misc
					$(lists).each(function(i, l) { l.buildPositionTable(); });
					list.setPos(e.pageX, e.pageY);
					$(document).bind("mousemove", list.mouseMove);
					$(document).bind("mouseup", list.dropItem);
					if (opts.scrollContainer != window)
						$(window).bind("DOMMouseScroll mousewheel", list.wheel);
				},

				//set position of draggedItem
				setPos: function(x, y) { 
					//remove mouse offset so mouse cursor remains in same place on draggedItem instead of top left corner
					var top = y - this.offset.top;
					var left = x - this.offset.left;

					//limit top, left to within box draggedItem can't be dragged outside of
					if (!opts.dragBetween) {
						top = Math.min(this.offsetLimit.bottom, Math.max(top, this.offsetLimit.top));
						left = Math.min(this.offsetLimit.right, Math.max(left, this.offsetLimit.left));
					}

					//adjust top, left calculations to parent element instead of window if it's relative or absolute
					this.draggedItem.parents().each(function() {
						if ($(this).css("position") != "static" && (!$.browser.mozilla || $(this).css("display") != "table")) {
							var offset = $(this).offset();
							top -= offset.top;
							left -= offset.left;
							return false;
						}
					});

					//set x or y auto-scroll amount
					if (opts.scrollContainer == window) {
						y -= $(window).scrollTop();
						x -= $(window).scrollLeft();
						y = Math.max(0, y - $(window).height() + 5) + Math.min(0, y - 5);
						x = Math.max(0, x - $(window).width() + 5) + Math.min(0, x - 5);
					} else {
						var cont = $(opts.scrollContainer);
						var offset = cont.offset();
						y = Math.max(0, y - cont.height() - offset.top) + Math.min(0, y - offset.top);
						x = Math.max(0, x - cont.width() - offset.left) + Math.min(0, x - offset.left);
					}
					
					list.scroll.moveX = x == 0 ? 0 : x * opts.scrollSpeed / Math.abs(x);
					list.scroll.moveY = y == 0 ? 0 : y * opts.scrollSpeed / Math.abs(y);

					//move draggedItem to new mouse cursor location
					this.draggedItem.css({ top: top, left: left });
				},

				//if scroll container is a div allow mouse wheel to scroll div instead of window when mouse is hovering over
				wheel: function(e) {
					if (($.browser.safari || $.browser.mozilla) && list && opts.scrollContainer != window) {
						var cont = $(opts.scrollContainer);
						var offset = cont.offset();
						if (e.pageX > offset.left && e.pageX < offset.left + cont.width() && e.pageY > offset.top && e.pageY < offset.top + cont.height()) {
							var delta = e.detail ? e.detail * 5 : e.wheelDelta / -2;
							cont.scrollTop(cont.scrollTop() + delta);
							e.preventDefault();
						}
					}
				},

				//build a table recording all the positions of the moveable list items
				buildPositionTable: function() {
					var pos = [];
					this.getItems().not([list.draggedItem[0], list.placeHolderItem[0]]).each(function(i) {
						var loc = $(this).offset();
						loc.right = loc.left + $(this).outerWidth();
						loc.bottom = loc.top + $(this).outerHeight();
						loc.elm = this;
						pos[i] = loc;
					});
					this.pos = pos;
				},

                dropItem:function(e){
                    if (list.draggedItem == null)
                        return;

                    //cleanup styles and remove placeholders
                    var orig = list.draggedItem.attr("data-origstyle");
                    list.draggedItem.attr("style", orig);
                    if (orig == "")
                        list.draggedItem.removeAttr("style");
                    list.draggedItem.removeAttr("data-origstyle");

                    list.styleDragHandlers(true);
                    list.placeHolderItem.remove();
                    $("[data-droptarget], .dragSortItem").remove();

                    window.clearInterval(list.scroll.scrollY);
                    window.clearInterval(list.scroll.scrollX);


                    //Do the droppin action

                    //Check if dropped on another item
                    //Over another item?
                    var ei = list.findPos(e.pageX, e.pageY);
					var nlist = list;
					for (var i = 0; ei == -1 && opts.dragBetween && i < lists.length; i++) {
						ei = lists[i].findPos(e.pageX, e.pageY);
						nlist = lists[i];
					}
                    if(ei > -1){
                        console.log('drop on ' + ei)
                        var context = (opts.context == null) ? list.draggedItem : opts.context;
                        opts.dragEnd.apply(context, new Array(list.draggedItem, list.pos[ei].elm));

                    //Moving (ie dropped between items)
                    } else {
                        //If it's not over an item, check to see if it's between two
                    	var ei = list.findPosAfter(e.pageX, e.pageY);
                    	nlist = list;
                    	for (var i = 0; ei == null && opts.dragBetween && i < lists.length; i++) {
	                        ei = lists[i].findPosAfter(e.pageX, e.pageY);
	                        nlist = lists[i];
	                    }

                        console.log('drop after ' + ei)

                        //If dropped in a valid location, move it there!
                        if(ei != null){

                            var children = function() { return $(nlist.container).children().not(nlist.draggedItem); };
                            var fixed = children().not(opts.itemSelector).each(function(i) { this.idx = children().index(this); });

                            if (ei > -1){
                                $(nlist.pos[ei].elm).after(list.draggedItem);
                            } else {
                                $(nlist.pos[0].elm).before(list.draggedItem);
                            }

                       	//If position changed call dragEnd
                            if (list.draggedItem.attr("data-origpos") != $(lists).index(list) + "-" + list.getItems().index(list.draggedItem)){
                                var context = (opts.context == null) ? list.draggedItem : opts.context;
                                opts.dragEnd.apply(context, new Array(list.draggedItem));
                            }
                        }
                    }

                    newList.cleanupDrop();
                    return false
                },

                cleanupDrop:function(){
                    //remove handlers and null vars
                    helpers.forEach(function(e){e.hide()});
                    helpers = [];
                    list.draggedItem = null;
                    $(document).unbind("mousemove", list.mouseMove);
                    $(document).unbind("mouseup", list.dropItem);
                    if (opts.scrollContainer != window)
                        $(window).unbind("DOMMouseScroll mousewheel", list.wheel);
                },

                mouseMove:function(e){
                    if (list.draggedItem == null)
                        return false;

                    //move draggedItem to mouse location
                    list.setPos(e.pageX, e.pageY);

                    //Get the mouse info so we can display the helpers and set drop placement

                    //hide all the helpers
                    helpers.forEach(function(e){e.hide()});
                    helpers = [];

                    //TODO: Store the value so we can get it on drop rather than recalculating it

                    //Check to see if it's over another item?
                    var ei = list.findPos(e.pageX, e.pageY);
					var nlist = list;
					for (var i = 0; ei == -1 && opts.dragBetween && i < lists.length; i++) {
						ei = lists[i].findPos(e.pageX, e.pageY);
						nlist = lists[i];
					}
					//If it is, show the drop icon
                    if(ei > -1){
                        helpers.push($(nlist.pos[ei].elm).find('.dropIcon').show());
                        return false;
                    }

                    //If it's not over an item, check to see if it's between two
                    var ei = list.findPosAfter(e.pageX, e.pageY);
                    nlist = list;
                    for (var i = 0; ei == null && opts.dragBetween && i < lists.length; i++) {
                        ei = lists[i].findPosAfter(e.pageX, e.pageY);
                        nlist = lists[i];
                    }

                    if(ei != null){
                        if(ei == -1){
                            helpers.push($(nlist.pos[ei+1].elm).find('.moveLeftIcon').show());
                        } else if (ei == nlist.pos.length-1){
                            helpers.push($(nlist.pos[ei].elm).find('.moveRightIcon').show());
                        } else {
                            helpers.push($(nlist.pos[ei].elm).find('.moveRightIcon').show());
                            helpers.push($(nlist.pos[ei+1].elm).find('.moveLeftIcon').show());
                        }
                    }

                    return false;
                },

				//returns the index of the list item the mouse is over
				findPos: function(x, y) {
					for (var i = 0; i < this.pos.length; i++) {
                        var tol = opts.dragTolerance;
						if (this.pos[i].left+tol < x && this.pos[i].right-tol > x && this.pos[i].top < y && this.pos[i].bottom > y)
							return i;
					}
					return -1;
				},

				//returns the index of the item to the right (after) when between items
                findPosAfter: function(x, y) {
                    for (var i = 0; i < this.pos.length; i++) {
                        var tol = opts.dragTolerance;
                        var rightHeight = this.pos[i].top < y && this.pos[i].bottom > y;
                        
                        //check if within parent container
                        if(x + tol < this.container.offsetLeft || x - tol > this.container.offsetLeft + this.container.offsetWidth){
                        	return null;
                        }

                        //special case for first item
                        if(rightHeight && i == 0){
                            if(this.pos[i].left > x){
                                return -1
                            }
                        }
                        //normal items
                        if(rightHeight && i < this.pos.length - 1){
                            //between i and next item
                            if((this.pos[i].right - tol < x && this.pos[i+1].left + tol > x) ||
                                //right of rightmost i in row
                               (this.pos[i].right - tol < x && this.pos[i].right > this.pos[i+1].left)){
                                return i
                            }
                            //left of leftmost i in row
                            if(this.pos[i].left + tol > x){
                                return i-1
                            }
                        }
                        //special case for last item
                        if(rightHeight && i == this.pos.length - 1){
                            if(this.pos[i].right - tol < x){
                                return i
                            } else {
                                return i-1
                            }
                        }
                    }
                    return null;
                }
			};

			newList.init();
			lists.push(newList);
		});

		return this;
	};

	$.fn.dragsort.defaults = {
		itemSelector: "",
		dragSelector: "",
		dragSelectorExclude: "input, textarea",
		dragEnd: function() { },
		dragBetween: false,
		placeHolderTemplate: "",
		scrollContainer: window,
		context: null,
		scrollSpeed: 5,
		dragTolerance: 30
	};

})(jQuery);
