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
  private columnIndexToLeftMap: any = {
    0: 0,
    min: this.scrollStartIndex + 1,
    max: this.scrollEndIndex,
  };
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

    for (let i = 0; i < this.preloadColumnCount; i++) {
      const columnIndex = getColumnIndex(rows[0][i]);

      if (this.columnIndexToLeftMap[columnIndex] !== undefined) {
        continue;
      }

      if (this.columnIndexToLeftMap[columnIndex - 1] !== undefined) {
        // scroll to the right
        this.columnIndexToLeftMap[columnIndex] =
          this.columnIndexToLeftMap[columnIndex - 1] +
          Math.max(maxForEachColumn[i] * 10, this.minCellWidthInPx);
      } else if (this.columnIndexToLeftMap[columnIndex + 1] !== undefined) {
        // scroll to the left
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
    const leftBound = this.columnIndexToLeftMap[this.scrollStartIndex];
    const rightBound =
      this.columnIndexToLeftMap[this.scrollEndIndex] -
      this.containerWidthInPx * 1.2;

    if (scrollLeft > rightBound) {
      this.incrementScrollIndex();
    } else if (
      scrollLeft < leftBound &&
      this.scrollStartIndex >= this.visibleColumnCount
    ) {
      this.decrementScrollIndex();
    }

    for (
      let i = Math.min(
        this.scrollStartIndex + 1,
        this.columnIndexToLeftMap.min
      );
      i <= Math.max(this.scrollEndIndex, this.columnIndexToLeftMap.max);
      i++
    ) {
      if (
        this.columnIndexToLeftMap[i] !== undefined &&
        i < this.scrollStartIndex
      ) {
        delete this.columnIndexToLeftMap[i];
      } else if (
        this.columnIndexToLeftMap[i] !== undefined &&
        i > this.scrollEndIndex
      ) {
        delete this.columnIndexToLeftMap[i];
      }
    }
    this.columnIndexToLeftMap.min = this.scrollStartIndex + 1;
    this.columnIndexToLeftMap.max = this.scrollEndIndex;
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
