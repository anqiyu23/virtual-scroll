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
  private scrollStartIndex = 0;
  private visibleColumnCount = 5;
  private scrollEndIndex = this.visibleColumnCount * 3;
  private columnIndexToLeftMap: any = {
    0: 0,
    min: this.scrollStartIndex + 1,
    max: this.scrollEndIndex,
  };
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
    const max = Array(15).fill(0);
    for (let i = 1; i < rows.length; i++) {
      for (let j = 0; j < rows[0].length; j++) {
        max[j] = Math.max(max[j], rows[i][j] ? rows[i][j].length : 0);
      }
    }

    for (let i = 0; i < 15; i++) {
      const index = +rows[0][i].split('field_')[1];
      if (this.columnIndexToLeftMap[index] !== undefined) {
        continue;
      }
      if (this.columnIndexToLeftMap[index - 1] !== undefined) {
        this.columnIndexToLeftMap[index] =
          Math.max(max[i] * 8, 200) + this.columnIndexToLeftMap[index - 1];
      } else if (this.columnIndexToLeftMap[index + 1] !== undefined) {
        this.columnIndexToLeftMap[index] =
          -Math.max(max[i + 1] * 8, 200) + this.columnIndexToLeftMap[index + 1];
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
        ? parseInt(columnNames[index - 1].split('field_')[1])
        : parseInt(columnNames[index].split('field_')[1]) - 1;
    return this.columnIndexToLeftMap[columnIndex];
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
