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
  // @ts-ignore
  @ViewChild('container', { static: true }) container: ElementRef;

  public rows: string[][] = [];
  public cellWidthInPx = 200;
  public cellCount = 5;
  public containerWidthInPx = this.cellWidthInPx * this.cellCount;

  private filePath = '../assets/acho_export_virtual_scroll.csv';
  private first50RowsWithAllColumns: string[][] = [];
  private scrollStartIndex = 0;
  private scrollEndIndex = this.cellCount * 3;
  private subscription: Subscription = new Subscription();

  public posMap: any = { 0: 0, min: 1, max: 15 };

  constructor(private http: HttpClient, private papa: Papa) {}

  public ngOnInit(): void {
    this.subscription = this.loadFile(this.filePath).subscribe(
      (data: string) => this.parseData(data),
      (error: HttpErrorResponse) => this.handleLoadFileError(error)
    );
  }

  public ngAfterViewInit() {
    this.buttonClick();
  }

  public buttonClick() {
    this.subscription = fromEvent(this.container.nativeElement, 'scroll')
      .pipe(throttleTime(50))
      .subscribe(() => this.onScroll());
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
    this.computeWidth(data);
    console.log(this.posMap);
    this.rows = data;
  }

  private computeWidth(data: string[][]) {
    const max = Array(15).fill(0);
    for (let i = 1; i < data.length; i++) {
      for (let j = 0; j < data[0].length; j++) {
        max[j] = Math.max(max[j], data[i][j] ? data[i][j].length : 0);
      }
    }
    for (let i = 0; i < 15; i++) {
      const index = +data[0][i].split('field_')[1];
      if (this.posMap[index] !== undefined) {
        continue;
      }
      if (this.posMap[index - 1] !== undefined) {
        this.posMap[index] = Math.max(max[i] * 8, 200) + this.posMap[index - 1];
      } else if (this.posMap[index + 1] !== undefined) {
        this.posMap[index] =
          -Math.max(max[i + 1] * 8, 200) + this.posMap[index + 1];
      }
    }
  }

  private handleLoadFileError(error: HttpErrorResponse): void {
    console.log(error.message);
  }

  public getLeft(index: number): number {
    const columnNames = this.rows[0];
    const columnIndex =
      index >= columnNames.length
        ? parseInt(columnNames[index - 1].split('field_')[1])
        : parseInt(columnNames[index].split('field_')[1]) - 1;
    return this.posMap[columnIndex];
  }

  public onScroll() {
    const scrollLeft = this.container.nativeElement.scrollLeft;
    const leftBound = this.posMap[this.scrollStartIndex];
    const rightBound = this.posMap[this.scrollEndIndex - 1] - 1200;

    console.error('scrollLeft', scrollLeft);
    console.error('leftBound', leftBound);
    console.error('rightBound', rightBound);

    if (scrollLeft > rightBound) {
      this.incrementScrollIndex();
    } else if (
      scrollLeft < leftBound &&
      this.scrollStartIndex >= this.cellCount
    ) {
      this.decrementScrollIndex();
    }
    for (
      let i = Math.min(this.scrollStartIndex + 1, this.posMap.min);
      i <= Math.max(this.scrollEndIndex, this.posMap.max);
      i++
    ) {
      if (this.posMap[i] !== undefined && i < this.scrollStartIndex) {
        delete this.posMap[i];
      } else if (this.posMap[i] !== undefined && i > this.scrollEndIndex) {
        delete this.posMap[i];
      }
    }
    this.posMap.min = this.scrollStartIndex + 1;
    this.posMap.max = this.scrollEndIndex;
    this.updateRows();
  }

  private incrementScrollIndex(): void {
    this.scrollStartIndex += this.cellCount;
    this.scrollEndIndex += this.cellCount;
  }

  private decrementScrollIndex(): void {
    this.scrollStartIndex -= this.cellCount;
    this.scrollEndIndex -= this.cellCount;
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
