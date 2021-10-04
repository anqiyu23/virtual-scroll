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
  public columnNames: string[] = [];
  public rows: any[] = [];

  private subscription: Subscription = new Subscription();
  private readonly filePath = '../assets/acho_export_virtual_scroll.csv';

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
        this.columnNames = result.data[0];
        this.rows = result.data.slice(1, 50);
      },
    });
  }

  private handleLoadFileError(error: HttpErrorResponse): void {
    console.log(error.message);
  }
}
