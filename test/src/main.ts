import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import '@angular/localize/init';

bootstrapApplication(AppComponent).catch(err => console.error(err));
