"use strict";

(function (MediumEditor) {
     var _getFirstSelectableLeafNode = MediumEditor.util.getFirstSelectableLeafNode;
     MediumEditor.util.getFirstSelectableLeafNode = function (element) {
          try {
               return _getFirstSelectableLeafNode.apply(this, arguments);
          }
          catch (ex) {
               console.warn('Medium Editor exception - getFirstSelectableLeafNode', ex);

               // recover from MediumEditor error (bug)
               var $selected = $(MediumEditor.selection.getSelectedElements(document));
               while ($selected.children().length) $selected = $selected.children()[0];
               return $selected[0];
          }
     };


     var _importSelectionMoveCursorPastBlocks = MediumEditor.selection.importSelectionMoveCursorPastBlocks;
     MediumEditor.selection.importSelectionMoveCursorPastBlocks = function () {
          try {
               return _importSelectionMoveCursorPastBlocks.apply(this, arguments);
          }
          catch (ex) {
               console.warn('Medium Editor exception - importSelectionMoveCursorPastBlocks', ex);
          }
     };

    MediumEditor.selection.isActive = function () {
        var selection = document.getSelection();
        var selected = selection && selection.rangeCount;
        return !!selected;
    };

     // fixed selection re #415: unable to add links to the whole paragraph in page builder.
     MediumEditor.selection.importSelectionMoveCursorPastBlocks = function (doc, root, index, range) {
          var treeWalker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, filterOnlyParentElements, false),
              startContainer = range.startContainer,
              startBlock,
              targetNode,
              currIndex = 0;

          // >>>>>>>>>>>> commented this out
          //index = index || 1; // If index is 0, we still want to move to the next block

          // Chrome counts newlines and spaces that separate block elements as actual elements.
          // If the selection is inside one of these text nodes, and it has a previous sibling
          // which is a block element, we want the treewalker to start at the previous sibling
          // and NOT at the parent of the textnode
          if (startContainer.nodeType === 3 && MediumEditor.util.isBlockContainer(startContainer.previousSibling)) {
               startBlock = startContainer.previousSibling;
          } else {
               startBlock = MediumEditor.util.getClosestBlockContainer(startContainer);
          }

          // >>>>>>>>>>> added this block
          if (startBlock) {
               index = index || 1;
          }

          // Skip over empty blocks until we hit the block we want the selection to be in
          while (treeWalker.nextNode()) {
               if (!targetNode) {
                    // Loop through all blocks until we hit the starting block element
                    // >>>>>>>>>>> startBlock can be falsy, added !startBlock
                    if (!startBlock || startBlock === treeWalker.currentNode) {
                         targetNode = treeWalker.currentNode;
                    }
               } else if (index) {
                    targetNode = treeWalker.currentNode;
                    currIndex++;
                    // We hit the target index, bail
                    if (currIndex === index) {
                         break;
                    }
                    // If we find a non-empty block, ignore the emptyBlocksIndex and just put selection here
                    if (targetNode.textContent.length > 0) {
                         break;
                    }
               }
          }

          // We're selecting a high-level block node, so make sure the cursor gets moved into the deepest
          // element at the beginning of the block
          range.setStart(MediumEditor.util.getFirstSelectableLeafNode(targetNode), 0);

          return range;
     };

     function filterOnlyParentElements(node) {
          if (MediumEditor.util.isBlockContainer(node)) {
               return NodeFilter.FILTER_ACCEPT;
          } else {
               return NodeFilter.FILTER_SKIP;
          }
     }

})(MediumEditor);
