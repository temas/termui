let termkit = require( 'terminal-kit' );
let term = termkit.terminal ;

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}
function rectInset(rect, depth) {
  return {
    x:rect.x + inset,
    y:rect.y + inset,
    w:rect.w - (inset * 2),
    h:rect.h - (insert * 2)
  };
}

class Widget
{
  constructor ()
  {
    this.focussed = false;
  }

  focus() {
    this.focussed = true;
  }

  onKey(name, matches, data) {
    // BASE noop
  }
}

class BorderBox extends Widget
{
  constructor() {
    super();
  }

  render(rect) {
      let clientRect = rectInset(rect, 1);
      this.child.render(clientRect);
      drawBox(rect);
  }
}

class CheckBox extends Widget
{
  constructor() {
    super();
    this.checked = false;
  }
  render(rect) {
    term.moveTo(rect.x, rect.y);
    term("[");
    term(this.checked ? "X" : " ");
    term("]");
  }
}

class RowLabel
{
  render(rect, data)
  {
    term.moveTo(rect.x, rect.y).red(data.txt);
  }
}

// Pondering extending BorderBox?
class ListBox extends Widget
{
  constructor() {
    super();
    this.rows = [];
    this.visibleRowCount = 0;
    this.topVisibleIndex = 0;
    this.selectable = true;
    this.selectedRow = 0;
  }

  get needsScrollbar() { return this.rows.length > this.visibleRowCount; }

  render(rect) {
    this.visibleRowCount = rect.h - 2;
    drawBox(rect);
    // If we have more rows than height we'll have to scroll so save scrollbar space
    if (this.needsScrollbar) {
      rect.w -= 1;
      let curScrollPos  = Math.floor((this.selectedRow / this.rows.length) * this.visibleRowCount);
      if (curScrollPos < 0) {
        curScrollPos = 0;
      } else if (curScrollPos >= this.visibleRowCount) {
        curScrollPos = this.visibleRowCount - 1;
      }
      for (let i = 0; i < this.visibleRowCount; ++i) {
        term.moveTo(rect.x + rect.w - 1, rect.y + 1 + i).bgColorRgb(127, 127, 127).red((i == curScrollPos) ? termkit.spChars.fullBlock : " ");
      }
    }
    for (let rowId = 0; (rowId + this.topVisibleIndex < this.rows.length && rowId < this.visibleRowCount); ++rowId) {
      let rowRect = {
        x:rect.x + 1,
        y:rect.y + 1 + rowId,
        w:rect.w,
        h:1
      };
      // pre-"paint" the row background
      term.moveTo(rowRect.x, rowRect.y);
      if (this.selectedRow == (rowId + this.topVisibleIndex)) {
        term.bgYellow();       
      } else {
        term.bgBlack();
      }
      for (let i = 0; i < rowRect.w - 2; ++i) {
        term(" ");
      }
      // add a checkbox if it's a selectable listbox
      if (this.selectable) {
        term.blue();
        term.moveTo(rowRect.x, rowRect.y);
        term("[");
        term(this.rows[rowId + this.topVisibleIndex].selected ? "X" : " ");
        term("]");
        rowRect.x += 4;
      }
      this.rowRenderer.render(rowRect, this.rows[rowId + this.topVisibleIndex]);
    }
  }

  onKey(name, matches, data) {
    if (name === "UP") {
      /*
      this.topVisibleIndex--;
      if (this.topVisibleIndex < 0) this.topVisibleIndex = 0;
      */
      this.selectedRow = clamp(this.selectedRow-1, 0, this.rows.length);
      if (this.selectedRow < this.topVisibleIndex) {
        this.topVisibleIndex--;
      }
    }
    if (name === "DOWN") {
      this.selectedRow = clamp(this.selectedRow+1, 0, this.rows.length - 1);
      if (this.selectedRow > (this.topVisibleIndex + this.visibleRowCount - 1)) {
        this.topVisibleIndex++;
      }
      /*
      this.topVisibleIndex++;
      if ((this.rows.length > this.visibleRowCount) && (this.topVisibleIndex > (this.rows.length - this.visibleRowCount))) {
        this.topVisibleIndex = this.rows.length - this.visibleRowCount;
      }
      */
    }
    if (name === "PAGE_DOWN") {
      this.topVisibleIndex = clamp(this.topVisibleIndex + this.visibleRowCount, 0, (this.rows.length - this.visibleRowCount));
    }
    if (name === "PAGE_UP") {
      this.topVisibleIndex = clamp(this.topVisibleIndex - this.visibleRowCount, 0, this.rows.length);
    }
    if (name === " ") {
      this.rows[this.selectedRow].selected = !this.rows[this.selectedRow].selected; 
    }
    this.render({
      x:2,
      y:2,
      w:100,
      h:10
    });
  }
}

function drawBox(rect, colors, chars=termkit.spChars.box.dotted) {

  term.bgBlack().blue();
  for (let j = 0; j < rect.h; ++j) {
    term.moveTo(rect.x, rect.y + j);
    term(j == 0 ? chars.topLeft : (j == (rect.h - 1)) ? chars.bottomLeft : chars.vertical);
    term.moveTo(rect.x + rect.w - 1, rect.y + j);
    term(j == 0 ? chars.topRight : (j == (rect.h - 1)) ? chars.bottomRight : chars.vertical);
  }
  for (let i = 1; i < rect.w - 1; ++i) {
    term.moveTo(rect.x + i, rect.y);
    term(chars.horizontal);
    term.moveTo(rect.x + i, rect.y + rect.h - 1);
    term(chars.horizontal);
  }
}

let focusWidget = undefined;

term.on("resize", function() {
  redraw();
});
term.on( 'key' , function( name , matches , data ) {
  focusWidget.onKey(name, matches, data);
  if ( name === 'CTRL_C' ) { terminate() ; }
} ) ;

term.on( 'terminal' , function( name , data ) {
    //console.log( "'terminal' event:" , name , data ) ;
} ) ;

term.on( 'mouse' , function( name , data ) {
    //console.log( "'mouse' event:" , name , data ) ;
} ) ;

function redraw()
{
  term.bgBlack().clear();

  if (term.width < 120) {
    term.red("Don't be a chump, make your terminal width at least 120 characters.");
    return;
  }

  let lb = new ListBox();
  lb.rowRenderer = new RowLabel();
  lb.rows = [];
  for (let i = 0; i < 20; ++i) {
    lb.rows.push({txt:`test ${i}`, selected:false});
  }
  lb.render({
    x:2,
    y:2,
    w:100,
    h:10
  });
  lb.focus();
  focusWidget = lb;
}

function terminate()
{
    term.grabInput( false ) ;
    term.reset();
    setTimeout( function() { process.exit() } , 100 ) ;
}

term.fullscreen();
term.hideCursor();
term.grabInput( { mouse: 'button' } ) ;
redraw();