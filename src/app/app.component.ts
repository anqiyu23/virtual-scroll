import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, Subscription } from 'rxjs';
import { Papa, ParseResult } from 'ngx-papaparse';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  public rows: string[][] = [];

  private subscription: Subscription = new Subscription();

  private readonly filePath = '../assets/acho_export_virtual_scroll.csv';
  private readonly cellWidthInPx = 200;

  constructor(private http: HttpClient, private papa: Papa) {}

  public ngOnInit(): void {
    this.subscription = this.loadFile(this.filePath).subscribe(
      (data: string) => this.parseData(data),
      (error: HttpErrorResponse) => this.handleLoadFileError(error)
    );
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private loadFile(filePath: string): Observable<string> {
    return this.http.get(filePath, { responseType: 'text' });
  }

  private parseData(data: string): void {
    this.papa.parse(data, {
      complete: (result: ParseResult) => {
        const first50RowsWithAllColumns: string[][] = result.data.slice(0, 50);
        const first50RowsWithFirst15Columns: string[][] =
          first50RowsWithAllColumns.map((row) => row.slice(0, 15));
        this.rows = first50RowsWithFirst15Columns;
      },
    });
  }

  private handleLoadFileError(error: HttpErrorResponse): void {
    console.log(error.message);
  }

  public getLeft(index: number): string {
    const columnNames = this.rows[0];
    const columnName = columnNames[index];
    const columnIndex = parseInt(columnName.split('field_')[1]) - 1;
    return this.cellWidthInPx * columnIndex + 'px';
  }
}
