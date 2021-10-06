import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { fromEvent, Observable, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { Papa, ParseResult } from 'ngx-papaparse';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('container') public container: ElementRef = {} as ElementRef;

  public rows: string[][] = [];
  public containerWidthInPx = 1000;

  private filePath = '../assets/acho_export_virtual_scroll.csv';
  private first50RowsWithAllColumns: string[][] = [];
  private minCellWidthInPx = 200;
  private scrollStartIndex = 0;
  private visibleColumnCount = 5;
  private scrollEndIndex = this.visibleColumnCount * 3;
  private columnIndexToLeftMap: { [key: number]: number } = { 0: 0 };
  private preloadColumnCount = this.visibleColumnCount * 3;
  private subscription: Subscription = new Subscription();

  constructor(private http: HttpClient, private papa: Papa) {}

  public ngOnInit(): void {
    this.subscription = this.loadFile(this.filePath).subscribe(
      (data: string) => this.parseData(data),
      (error: HttpErrorResponse) => this.handleLoadFileError(error)
    );
  }

  private loadFile(filePath: string): Observable<string> {
    return this.http.get(filePath, { responseType: 'text' });
  }

  private parseData(data: string): void {
    this.papa.parse(data, {
      complete: (result: ParseResult) => {
        this.first50RowsWithAllColumns = result.data.slice(0, 50);
        this.updateRows();
      },
    });
  }

  private updateRows(): void {
    const data = this.first50RowsWithAllColumns.map((row) =>
      row.slice(this.scrollStartIndex, this.scrollEndIndex)
    );
    this.setColumnIndexToLeftMap(data);
    this.rows = data;
  }

  private setColumnIndexToLeftMap(rows: string[][]): void {
    const maxForEachColumn = Array(this.preloadColumnCount).fill(0);

    // for each column, get the max length among all cells
    for (let i = 1; i < rows.length; i++) {
      for (let j = 0; j < this.preloadColumnCount; j++) {
        maxForEachColumn[j] = Math.max(
          maxForEachColumn[j],
          rows[i][j] ? rows[i][j].length : 0
        );
      }
    }

    // scroll to the right
    for (let i = 0; i < this.preloadColumnCount; i++) {
      const columnIndex = getColumnIndex(rows[0][i]);
      if (this.columnIndexToLeftMap[columnIndex] !== undefined) {
        continue;
      }

      if (this.columnIndexToLeftMap[columnIndex - 1] !== undefined) {
        // the position of the new column on the right depends on its left column
        this.columnIndexToLeftMap[columnIndex] =
          this.columnIndexToLeftMap[columnIndex - 1] +
          Math.max(maxForEachColumn[i] * 10, this.minCellWidthInPx);
      }
    }

    // scroll to the left
    for (let i = this.preloadColumnCount - 1; i >= 0; i--) {
      const columnIndex = getColumnIndex(rows[0][i]);
      if (this.columnIndexToLeftMap[columnIndex] !== undefined) {
        continue;
      }

      if (this.columnIndexToLeftMap[columnIndex + 1] !== undefined) {
        // the position of the new column on the left depends on its right column
        this.columnIndexToLeftMap[columnIndex] =
          this.columnIndexToLeftMap[columnIndex + 1] -
          Math.max(maxForEachColumn[i + 1] * 10, this.minCellWidthInPx);
      }
    }
  }

  private handleLoadFileError(error: HttpErrorResponse): void {
    console.log(error.message);
  }

  public ngAfterViewInit(): void {
    this.subscription = fromEvent(this.container.nativeElement, 'scroll')
      .pipe(throttleTime(50))
      .subscribe(() => this.onScroll());
  }

  private onScroll(): void {
    const scrollLeft = this.container.nativeElement.scrollLeft;
    const lefts = Object.values(this.columnIndexToLeftMap);
    const leftBound = lefts[1];
    const rightBound =
      lefts[lefts.length - 1] - this.minCellWidthInPx * this.visibleColumnCount;

    if (scrollLeft > rightBound) {
      this.incrementScrollIndex();
    } else if (
      scrollLeft < leftBound &&
      this.scrollStartIndex >= this.visibleColumnCount
    ) {
      this.decrementScrollIndex();
    }

    this.removeOutOfBoundColumnsFromMap();

    this.updateRows();
  }

  private incrementScrollIndex(): void {
    this.scrollStartIndex += this.visibleColumnCount;
    this.scrollEndIndex += this.visibleColumnCount;
  }

  private decrementScrollIndex(): void {
    this.scrollStartIndex -= this.visibleColumnCount;
    this.scrollEndIndex -= this.visibleColumnCount;
  }

  private removeOutOfBoundColumnsFromMap(): void {
    let newColumnIndexToLeftMap: { [key: number]: number } = { 0: 0 };
    for (
      let i = Math.max(0, this.scrollStartIndex - this.visibleColumnCount);
      i <= this.scrollEndIndex;
      i++
    ) {
      if (this.columnIndexToLeftMap[i] !== undefined) {
        newColumnIndexToLeftMap[i] = this.columnIndexToLeftMap[i];
      }
    }
    this.columnIndexToLeftMap = newColumnIndexToLeftMap;
  }

  public getLeft(index: number): number {
    const columnNames = this.rows[0];
    const columnIndex =
      index >= columnNames.length
        ? getColumnIndex(columnNames[index - 1])
        : getColumnIndex(columnNames[index]) - 1;
    return this.columnIndexToLeftMap[columnIndex];
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}

function getColumnIndex(columnName: string): number {
  return parseInt(columnName.split('field_')[1]);
}
